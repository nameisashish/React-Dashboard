"""Opt-in local preview only; always uses a separate SQLite preview.db."""
import os
os.environ['DATABASE_URL']='sqlite:///./preview.db'
from datetime import date, timedelta
from sqlalchemy import select
from database import Base, engine, SessionLocal
from main import hasher, uid, now, make_fine, FineInput
from models import User

if __name__=='__main__':
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(User.id).limit(1)):
            raise SystemExit('Preview already initialized. Existing accounts were left unchanged.')
        for role,label,email,password in [('Viewer','User','viewer@mars.demo','Viewer123!'),('Super User','Super User','reviewer@mars.demo','Review123!'),('Admin','Admin','admin@mars.demo','Admin123!')]:
            db.add(User(id=uid(),full_name=f'Preview {label.title()}',email=email,password_hash=hasher.hash(password),role=role,requested_role=role,status='Approved',registered_at=now()))
        for i in range(18):
            db.add(make_fine(FineInput(customerId=f'DEMO-{i%5+1:03}',customerName='Preview customer (sample data)',fineAmount=125+i*87.25,status=['Pending','Valid','Invalid'][i%3],reasonCategory=['Missing delivery evidence','Quantity mismatch','Damaged goods'][i%3],fineDate=date.today()-timedelta(days=i*4),sourceArea=['Warehouse','Logistics','Manufacturing'][(i//3)%3],orderReference=f'DEMO-ORDER-{i+1:03}')))
        db.commit()
    print('# Local preview access\n\nOpen http://127.0.0.1:5173. These accounts and sample records exist only in backend/preview.db.\n')
    print('| Login option | Email | Password |\n| --- | --- | --- |\n| User (Viewer) | viewer@mars.demo | Viewer123! |\n| Super User | reviewer@mars.demo | Review123! |\n| Admin | admin@mars.demo | Admin123! |')
    print('\nThis database contains sample records, not your real dataset. Do not deploy these demo accounts. Restart the API from backend/ with `DATABASE_URL=sqlite:///./preview.db ../.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000`. Restart React from frontend/ with `npm run dev`.')
