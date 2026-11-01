"""SQL Server connection used by the application.

The application intentionally fails at startup when SQL Server is not configured;
it must never create a local SQLite database as a fallback.
"""
import os
from urllib.parse import quote_plus
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()
url = os.getenv('DATABASE_URL')
if url:
    if not url.lower().startswith(('mssql://', 'mssql+pyodbc://')):
        raise RuntimeError('DATABASE_URL must point to SQL Server (mssql or mssql+pyodbc)')
elif os.getenv('DB_SERVER'):
    required = ['DB_SERVER', 'DB_NAME']
    if any(not os.getenv(key) for key in required):
        raise RuntimeError('Set DB_SERVER and DB_NAME for SQL Server')
    auth = os.getenv('DB_AUTH', 'sql').strip().lower()
    connection = (f"DRIVER={{{os.getenv('DB_DRIVER', 'ODBC Driver 18 for SQL Server')}}};"
                  f"SERVER={os.environ['DB_SERVER']};DATABASE={os.environ['DB_NAME']};"
                  f"Encrypt=yes;TrustServerCertificate={os.getenv('DB_TRUST_CERTIFICATE', 'no')};")
    if auth in ('windows', 'integrated'):
        connection += 'Trusted_Connection=yes;'
    elif auth == 'sql':
        if not os.getenv('DB_USERNAME') or not os.getenv('DB_PASSWORD'):
            raise RuntimeError('Set DB_USERNAME and DB_PASSWORD for SQL Server authentication')
        connection += f"UID={os.environ['DB_USERNAME']};PWD={os.environ['DB_PASSWORD']};"
    else:
        raise RuntimeError("DB_AUTH must be 'windows' or 'sql'")
    url = 'mssql+pyodbc:///?odbc_connect=' + quote_plus(connection)
else:
    raise RuntimeError('SQL Server is not configured. Set DATABASE_URL or DB_SERVER and DB_NAME.')

engine = create_engine(url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
Base = declarative_base()
def get_db():
    with SessionLocal() as session:
        yield session
