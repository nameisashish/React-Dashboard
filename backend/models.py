from sqlalchemy import Column, String, Text, JSON, Numeric, Integer, Date, DateTime, Boolean, BigInteger, LargeBinary
from sqlalchemy.dialects.mssql import TIMESTAMP
from database import Base, engine


if engine.dialect.name == 'mssql':
    class User(Base):
        __tablename__ = 'Users'
        __table_args__ = {'schema': 'dbo'}
        id = Column('user_id', Integer, primary_key=True, autoincrement=True)
        full_name = Column(String(100), nullable=False)
        email = Column(String(255), nullable=False)
        password_hash = Column(String(255), nullable=False)
        role = Column(String(20), nullable=False)
        status = Column('approval_status', String(20), nullable=False)
        registered_at = Column('created_at', DateTime, nullable=False)
        requested_role = Column(String(20), nullable=False)
        is_active = Column(Boolean, nullable=False)
        reviewed_by_user_id = Column(Integer)
        reviewed_at = Column(DateTime)
        review_comment = Column(String(1000))
        updated_at = Column(DateTime, nullable=False)

    class Session(Base):
        __tablename__ = 'sessions'
        __table_args__ = {'schema': 'dbo'}
        token_hash = Column(String(64), primary_key=True)
        user_id = Column(Integer, nullable=False, index=True)
        expires_at = Column(DateTime, nullable=False)

    class ActivityEvent(Base):
        __tablename__ = 'ActivityEvents'
        __table_args__ = {'schema': 'dbo'}
        id = Column('event_id', BigInteger, primary_key=True, autoincrement=True)
        fine_id = Column(Integer, index=True)
        target_user_id = Column(Integer)
        actor_user_id = Column(Integer, nullable=False)
        event_type = Column(String(30), nullable=False)
        field_name = Column(String(60))
        old_value = Column(String(500))
        new_value = Column(String(500))
        comment = Column(String(1000), nullable=False)
        created_at = Column(DateTime, nullable=False)

    Review = ActivityEvent

    class Fine(Base):
        __tablename__ = 'Fines'
        __table_args__ = {'schema': 'dbo'}
        id = Column('fine_id', Integer, primary_key=True, autoincrement=True)
        customer_id = Column(String(30), nullable=False)
        customer_name = Column(String(120), nullable=False)
        order_id = Column(String(40), nullable=False)
        invoice_id = Column(String(40), nullable=False)
        fine_date = Column(Date, nullable=False)
        amount = Column('fine_amount', Numeric(18, 2), nullable=False)
        reason = Column('fine_reason', String(250), nullable=False)
        source = Column('root_cause_area', String(30))
        status = Column('validation_status', String(20), nullable=False)
        ordered_qty = Column(Integer)
        produced_qty = Column(Integer)
        dispatched_qty = Column(Integer)
        delivered_qty = Column(Integer)
        promised_delivery_date = Column(Date)
        actual_delivery_date = Column(Date)
        evidence_notes = Column(Text)
        invoice_amount = Column(Numeric(18, 2), nullable=False)
        payment_due_date = Column(Date)
        retailer_paid_at = Column(DateTime)
        payment_received_at = Column(DateTime)
        amount_received = Column(Numeric(18, 2), nullable=False)
        payment_verified_at = Column(DateTime)
        finance_status = Column(String(30), nullable=False)
        updated_at = Column(DateTime, nullable=False)
        row_version = Column('row_version', TIMESTAMP(convert_int=False), nullable=False)

        @property
        def version(self):
            raw = bytes(self.row_version or b'\0\0\0\0\0\0\0\0')
            return int.from_bytes(raw[-4:], 'big') or 1

    class ImportBatch(Base):
        __tablename__ = 'import_batches'
        __table_args__ = {'schema': 'dbo'}
        id = Column(String(64), primary_key=True)

else:
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

    ActivityEvent = Review

    class ImportBatch(Base):
        __tablename__ = 'import_batches'
        id = Column(String(64), primary_key=True)
