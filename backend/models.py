from sqlalchemy import Column, String, Text, JSON, Numeric, Integer
from database import Base

class User(Base):
    __tablename__ = 'users'
    id = Column(String(36), primary_key=True)
    full_name = Column(String(120), nullable=False)
    email = Column(String(254), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    role = Column(String(20), nullable=False)
    status = Column(String(30), nullable=False)
    registered_at = Column(String(40), nullable=False)
    requested_role = Column(String(20), nullable=False)

class Session(Base):
    __tablename__ = 'sessions'
    token_hash = Column(String(64), primary_key=True)
    user_id = Column(String(36), nullable=False)
    expires_at = Column(String(40), nullable=False)

class Fine(Base):
    __tablename__ = 'fines'
    id = Column(String(36), primary_key=True)
    customer_id = Column(String(120), nullable=False)
    amount = Column(Numeric(18, 2), nullable=False)
    status = Column(String(20), nullable=False)
    fine_date = Column(String(10), nullable=False)
    source = Column(String(30), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    data = Column(JSON, nullable=False)

class Review(Base):
    __tablename__ = 'reviews'
    id = Column(String(36), primary_key=True)
    fine_id = Column(String(36), nullable=False, index=True)
    data = Column(JSON, nullable=False)
