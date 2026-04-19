import logging
from pythonjsonlogger import jsonlogger
import os
import yaml

# 创建日志记录器
logger = logging.getLogger('json_logger')
logger.setLevel(logging.INFO)

# 创建处理器
logHandler = logging.StreamHandler()
# 创建JSON格式化器
formatter = jsonlogger.JsonFormatter('%(asctime)s %(name)s %(levelname)s %(message)s')
# 将格式化器添加到处理器
logHandler.setFormatter(formatter)
# 将处理器添加到记录器
logger.addHandler(logHandler)

# 获取当前脚本的目录
script_dir = os.path.dirname(__file__)
# 构造相对路径
config_path = os.path.join(script_dir, '..', 'config.yaml')
# 读取YAML文件
with open(config_path, 'r') as file:
    config = yaml.safe_load(file)