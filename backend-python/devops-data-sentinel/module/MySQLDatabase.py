from peewee import MySQLDatabase


class MySQLDatabaseManager:
    def __init__(self, database, user, password, host, port=3306):
        self.database = database
        self.user = user
        self.password = password
        self.host = host
        self.port = port
        self.db = None

    def connect(self):
        self.db = MySQLDatabase(
            self.database,
            user=self.user,
            password=self.password,
            host=self.host,
            port=self.port
        )
        self.db.connect()

    def close(self):
        if self.db:
            self.db.close()

    def execute_sql(self, sql, params=None):
        if self.db.is_closed():
            raise Exception("Database not connected. Call connect() first.")
        cursor = self.db.execute_sql(sql, params or ())
        # 获取列名
        columns = [desc[0] for desc in cursor.description]
        # 将结果转换为字典
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return results
