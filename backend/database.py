"""SQLite for local development; SQL Server through DATABASE_URL or DB_* settings."""
import os
from urllib.parse import quote_plus
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()
url = os.getenv('DATABASE_URL')
if not url and os.getenv('DB_SERVER'):
    required = ['DB_SERVER', 'DB_NAME', 'DB_USERNAME', 'DB_PASSWORD']
    if any(not os.getenv(key) for key in required):
        raise RuntimeError('Set all DB_SERVER, DB_NAME, DB_USERNAME and DB_PASSWORD settings')
    connection = (f"DRIVER={{{os.getenv('DB_DRIVER', 'ODBC Driver 18 for SQL Server')}}};"
                  f"SERVER={os.environ['DB_SERVER']};DATABASE={os.environ['DB_NAME']};"
                  f"UID={os.environ['DB_USERNAME']};PWD={os.environ['DB_PASSWORD']};"
                  f"Encrypt=yes;TrustServerCertificate={os.getenv('DB_TRUST_CERTIFICATE', 'no')};")
    url = 'mssql+pyodbc:///?odbc_connect=' + quote_plus(connection)
url = url or 'sqlite:///./fines.db'
engine = create_engine(url, pool_pre_ping=True, connect_args={'check_same_thread': False} if url.startswith('sqlite') else {})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
Base = declarative_base()
def get_db():
    with SessionLocal() as session:
        yield session
