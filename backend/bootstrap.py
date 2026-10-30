"""Create the first administrator; credentials are prompted, never hardcoded."""
from getpass import getpass
from pydantic import EmailStr, TypeAdapter
from database import Base, engine, SessionLocal
from main import hasher, uid, now
from models import User
from sqlalchemy import select

if __name__ == '__main__':
    email=str(TypeAdapter(EmailStr).validate_python(input('Administrator email: ').strip())).lower()
    name=input('Full name: ').strip()
    password=getpass('Password (at least 12 characters): ')
    if len(password)<12 or not name: raise SystemExit('Name and a password of at least 12 characters are required.')
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email==email)): raise SystemExit('Account already exists.')
        db.add(User(id=uid(),full_name=name,email=email,password_hash=hasher.hash(password),role='Admin',requested_role='Admin',status='Approved',registered_at=now()))
        db.commit()
    print('Administrator created.')
