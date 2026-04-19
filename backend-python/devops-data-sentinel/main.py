import requests
import datetime
from module import logger, config
from module import MySQLDatabaseManager


def get_pod_ips(thanos, info):
    # Make the API request.
    # Use `params=` so `requests` URL-encodes the PromQL query correctly.
    # Previously an `&`/`#`/space in the query would truncate or break routing.
    request_url = "{0}/api/v1/query".format(thanos)
    response = requests.get(
        request_url,
        params={"query": info.get("query")},
        timeout=10,
    )

    # Check if the request was successful
    result = response.json() if response.status_code == 200 else None
    if result and result.get("status") == "success":
        # Parse the JSON data to extract Pod IPs. Tolerate missing 'metric'.
        ips = [
            (pod_info.get('metric') or {}).get('ip')
            for pod_info in (result.get('data') or {}).get('result') or []
        ]
        return [ip for ip in ips if ip]
    else:
        message = result if result else "response status_code {0}".format(response.status_code)
        raise Exception("Error querying Thanos API:", message)


def check_utxoswap_sequencer_by_miner(ip_list):
    is_miner = False
    for ip in ip_list:
        request_url = "http://{0}:3300/api/v1/sequencer/pools/status".format(ip)
        try:
            response = requests.get(request_url, timeout=5)
        except requests.RequestException:
            # Skip this pod and keep probing the rest; previously a single
            # network blip aborted the entire miner check.
            continue
        result = response.json() if response.status_code == 200 else None
        # Guard against `data` being missing/null; the original
        # `result.get("data").get(...)` would raise AttributeError.
        data = (result or {}).get("data") or {}
        is_miner = bool(data.get("isMiner"))
        if is_miner:
            break
    return is_miner


def check_utxoswap_intents_by_status(info):
    # 使用读取的配置
    environment = config.get("monitor").get("environment")
    database = info.get("database")
    db_manager = MySQLDatabaseManager(
        database=database.get("db"),
        user=database.get("user"),
        password=database.get("password"),
        host=database.get("host"),
        port=database.get("port")
    )
    db_manager.connect()

    # 获取当前时间并计算时间范围
    now = datetime.datetime.now()
    last_time = now
    start_time = (last_time - datetime.timedelta(minutes=10)).strftime('%Y-%m-%d %H:%M:%S')
    end_time = (last_time - datetime.timedelta(minutes=5)).strftime('%Y-%m-%d %H:%M:%S')

    # Parameterised query — no user-controlled input today, but this keeps
    # the call site safe even if someone later sources the bounds from
    # config or a request. peewee forwards `params` to the DB-API driver.
    sql = """
            SELECT id FROM intents
            WHERE status = 0
              AND created_at BETWEEN %s AND %s
            LIMIT 1
            """

    # 执行原生SQL查询
    results = db_manager.execute_sql(sql, (start_time, end_time))
    if len(results) > 0:
        extra = {'namespace': info.get("namespace"), 'results': results}
        logger.error(f'UTXOSwap sequencer intent not on-chain for over 5 minutes.', extra=extra)
    else:
        logger.info(f'UTXOSwap sequencer intent data is normal', extra={'namespace': info.get("namespace")})
    db_manager.close()


if __name__ == "__main__":
    # 使用读取的配置
    environment = config.get("monitor").get("environment")
    thanos = config.get("monitor").get("thanos")
    for info in environment:
        # utxoswap_sequencer minner 状态检查
        try:
            ips = get_pod_ips(thanos, info)
            is_miner = check_utxoswap_sequencer_by_miner(ips)
            extra = {'namespace': info.get("namespace"), 'results': ips}
            if is_miner:
                logger.info('UTXOSwap sequencer miner is true', extra=extra)
            else:
                logger.error('UTXOSwap sequencer miner is false', extra=extra)
        except Exception as e:
            logger.error('python monitor script error: {0}'.format(e), extra={'namespace': "system"})

        # utxoswap_sequencer intents检查
        try:
            check_utxoswap_intents_by_status(info)
        except Exception as e:
            logger.error('python monitor script error: {0}'.format(e), extra={'namespace': "system"})