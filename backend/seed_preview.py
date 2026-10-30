"""Opt-in local preview only; always uses a separate SQLite preview.db."""
import os
import secrets
os.environ['DATABASE_URL']='sqlite:///./preview.db'
from datetime import date, timedelta
from sqlalchemy import select
from database import Base, engine, SessionLocal
from main import hasher, uid, now, make_fine, FineInput
from models import User

if __name__=='__main__':
    Base.metadata.create_all(engine)
    password=secrets.token_urlsafe(14)
    with SessionLocal() as db:
        if db.scalar(select(User.id).limit(1)):
            raise SystemExit('Preview already initialized. Existing accounts were left unchanged.')
        for role,label in [('Viewer','user'),('Super User','super'),('Admin','admin')]:
            db.add(User(id=uid(),full_name=f'Preview {label.title()}',email=f'{label}@preview.example.com',password_hash=hasher.hash(password),role=role,requested_role=role,status='Approved',registered_at=now()))
        for i in range(18):
            db.add(make_fine(FineInput(customerId=f'DEMO-{i%5+1:03}',customerName='Preview customer (sample data)',fineAmount=125+i*87.25,status=['Pending','Valid','Invalid'][i%3],reasonCategory=['Missing delivery evidence','Quantity mismatch','Damaged goods'][i%3],fineDate=date.today()-timedelta(days=i*4),sourceArea=['Warehouse','Logistics','Manufacturing'][(i//3)%3],orderReference=f'DEMO-ORDER-{i+1:03}')))
        db.commit()
    print('# Local preview access\n\nOpen http://127.0.0.1:5173. These accounts and sample records exist only in backend/preview.db.\n')
    print('| Login option | Email |\n| --- | --- |\n| User | user@preview.example.com |\n| Super User | super@preview.example.com |\n| Admin | admin@preview.example.com |')
    print(f'\nPassword for all three preview accounts: `{password}`\n\nThis database contains sample records, not your real dataset. Do not deploy these preview accounts. Restart the API from backend/ with `DATABASE_URL=sqlite:///./preview.db ../.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000`. Restart React from frontend/ with `npm run dev`.')
