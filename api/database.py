import logging
import os
import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv

load_dotenv()

# Configuración de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_server_connection():
    """Establece conexión al servidor MySQL sin especificar la base de datos."""
    try:
        connection = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            port=int(os.getenv("DB_PORT", 3306))
        )
        if connection.is_connected():
            return connection
    except Error as e:
        logger.error(f"Error al conectar al servidor MySQL: {e}")
        return None

def initialize_database():
    """Crea la base de datos si no existe."""
    connection = get_server_connection()
    if connection:
        try:
            cursor = connection.cursor()
            db_name = os.getenv("DB_NAME")
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name}")
            logger.info(f"Base de datos '{db_name}' verificada/creada exitosamente.")
            cursor.close()
        except Error as e:
            logger.error(f"Error al inicializar la base de datos: {e}")
        finally:
            connection.close()

def get_db_connection():
    db_name = os.getenv("DB_NAME")
    try:
        connection = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            database=db_name,
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            port=int(os.getenv("DB_PORT", 3306))
        )
        if connection.is_connected():
            return connection
    except Error as e:
        logger.error(f"Error al conectar la base de datos '{db_name}': {e}")
        return None

from contextlib import contextmanager

@contextmanager
def get_db_cursor(dictionary=False, commit_on_success=False):
    """
    Gestor de contexto para manejar la conexión y el cursor de la BD automáticamente.
    Maneja el commit, rollback y cierre de recursos.
    """
    connection = get_db_connection()
    if not connection:
        yield None
        return

    cursor = connection.cursor(dictionary=dictionary)
    try:
        if commit_on_success:
            connection.start_transaction()
        yield cursor
        if commit_on_success:
            connection.commit()
    except Exception as e:
        if commit_on_success:
            connection.rollback()
        raise e
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()
