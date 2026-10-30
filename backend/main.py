import hashlib
import io
import os
import secrets
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Literal, Optional
from uuid import uuid4
from zipfile import ZipFile, BadZipFile

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from openpyxl import load_workbook
from pydantic import BaseModel, EmailStr, Field, ValidationError, field_validator
from pwdlib import PasswordHash
from sqlalchemy import select, update, text, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession
from database import Base, engine, get_db
from models import User, Session, Fine, Review, ActivityEvent, ImportBatch

IS_SQLSERVER = engine.dialect.name == 'mssql'
ALLOW_PASSWORDLESS_LOGIN = os.getenv('ALLOW_PASSWORDLESS_LOGIN', os.getenv('ALLOW_USER_ID_LOGIN', 'false')).strip().lower() == 'true'

Status = Literal['Valid', 'Invalid', 'Pending']
Role = Literal['Admin', 'Super User', 'Viewer']
Source = Literal['Logistics', 'Warehouse', 'Manufacturing']
SourceFilter = Literal['Logistics', 'Warehouse', 'Manufacturing', 'Unknown']
hasher = PasswordHash.recommended()
bearer = HTTPBearer(auto_error=False)
def now(): return datetime.now(timezone.utc).isoformat()
def uid(): return str(uuid4())
def fail(code, detail): raise HTTPException(code, detail)
def app_role(role): return {'SuperUser': 'Super User', 'User': 'Viewer'}.get(role, role)
def db_role(role): return {'Super User': 'SuperUser', 'Viewer': 'User'}.get(role, role)
def public(user): return {'id': user.id, 'fullName': user.full_name, 'email': user.email, 'role': app_role(user.role)}
def dt_value(value):
    if isinstance(value, datetime): return value.isoformat()
    return value

@asynccontextmanager
async def lifespan(app):
    if not IS_SQLSERVER:
        Base.metadata.create_all(engine)
    yield

app = FastAPI(title='Fines & Fees API', version='2.0.0', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv('FRONTEND_ORIGIN', 'http://localhost:5173').split(','), allow_methods=['GET','POST','PATCH'], allow_headers=['Authorization','Content-Type'])

def current(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer), db: DBSession = Depends(get_db)):
    if not credentials: fail(401, 'unauthorized')
    session = db.get(Session, hashlib.sha256(credentials.credentials.encode()).hexdigest())
    if not session: fail(401, 'session-expired')
    expires = session.expires_at
    expired = expires < datetime.now(timezone.utc).replace(tzinfo=None) if isinstance(expires, datetime) else expires < now()
    if expired: fail(401, 'session-expired')
    user = db.get(User, session.user_id)
    if not user or user.status != 'Approved' or app_role(user.role) not in ['Admin', 'Super User', 'Viewer'] or (IS_SQLSERVER and not user.is_active): fail(403, 'unauthorized')
    return user

def admin(user=Depends(current)):
    if app_role(user.role) != 'Admin': fail(403, 'unauthorized')
    return user

def super_user(user=Depends(current)):
    if app_role(user.role) != 'Super User': fail(403, 'unauthorized')
    return user

def reviewer(user=Depends(current)):
    return super_user(user)

def exporter(user=Depends(current)):
    if app_role(user.role) not in ['Admin','Super User']: fail(403, 'unauthorized')
    return user

class Registration(BaseModel):
    fullName: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    requestedRole: Literal['Super User','Viewer'] = 'Viewer'
    @field_validator('fullName')
    @classmethod
    def name(cls, value):
        if not value.strip(): raise ValueError('Name is required')
        return value.strip()

class Login(BaseModel):
    userId: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, max_length=128)
    requestedRole: Optional[Role] = None

@app.get('/api/health')
def health(): return {'status':'ok'}

@app.get('/api/health/database')
def database_health(user=Depends(admin), db: DBSession=Depends(get_db)):
    db.execute(text('SELECT 1'))
    return {'status':'connected', 'database':os.getenv('DB_NAME') or engine.dialect.name}

@app.post('/api/auth/signup', status_code=201)
def signup(body: Registration, db: DBSession=Depends(get_db)):
    if IS_SQLSERVER:
        stamp = datetime.now(timezone.utc).replace(tzinfo=None)
        user = User(full_name=body.fullName, email=str(body.email).lower(), password_hash=hasher.hash(body.password), role='User', requested_role=db_role(body.requestedRole), status='Pending', is_active=False, registered_at=stamp, updated_at=stamp)
    else:
        user = User(id=uid(), full_name=body.fullName, email=str(body.email).lower(), password_hash=hasher.hash(body.password), role=body.requestedRole, requested_role=body.requestedRole, status='Pending Approval', registered_at=now())
    db.add(user)
    try: db.commit()
    except IntegrityError:
        db.rollback(); fail(409, 'account-exists')
    return {'status':'Pending Approval' if IS_SQLSERVER else user.status}

@app.post('/api/auth/signin')
def signin(body: Login, db: DBSession=Depends(get_db)):
    if ALLOW_PASSWORDLESS_LOGIN:
        if body.email:
            user = db.scalar(select(User).where(User.email == str(body.email).lower()))
        elif body.userId and body.userId.strip():
            try:
                user_key = int(body.userId) if IS_SQLSERVER else body.userId.strip()
            except ValueError:
                fail(401, 'invalid-credentials')
            user = db.get(User, user_key)
        else:
            fail(401, 'invalid-credentials')
    else:
        if not body.email or not body.password: fail(401, 'invalid-credentials')
        user = db.scalar(select(User).where(User.email == str(body.email).lower()))
        if not user or not hasher.verify(body.password, user.password_hash): fail(401, 'invalid-credentials')
    if not user: fail(401, 'invalid-credentials')
    if user.status not in ('Approved',) : fail(403, 'pending' if user.status in ('Pending', 'Pending Approval') else 'rejected')
    if IS_SQLSERVER and not user.is_active: fail(403, 'rejected')
    if body.requestedRole and app_role(user.role) != body.requestedRole: fail(403, 'wrong-role')
    token = secrets.token_urlsafe(48)
    expiry = datetime.now(timezone.utc) + timedelta(hours=8)
    if IS_SQLSERVER: expiry = expiry.replace(tzinfo=None)
    else: expiry = expiry.isoformat()
    db.add(Session(token_hash=hashlib.sha256(token.encode()).hexdigest(), user_id=user.id, expires_at=expiry))
    db.commit()
    return {'token':token, 'user':public(user)}

@app.get('/api/auth/me')
def me(user=Depends(current)): return public(user)

@app.post('/api/auth/logout')
def logout(credentials: HTTPAuthorizationCredentials=Depends(bearer), user=Depends(current), db: DBSession=Depends(get_db)):
    db.delete(db.get(Session, hashlib.sha256(credentials.credentials.encode()).hexdigest())); db.commit()
    return {'status':'signed-out'}

@app.get('/api/users/requests')
def requests(user=Depends(admin), db: DBSession=Depends(get_db)):
    result=[]
    for u in db.scalars(select(User).order_by(User.registered_at.desc())):
        status = ('Pending Approval' if u.status == 'Pending' else u.status) if IS_SQLSERVER else u.status
        item=dict(public(u), requestedRole=app_role(u.requested_role), assignedRole=app_role(u.role) if u.status=='Approved' else None, status=status, registeredAt=dt_value(u.registered_at))
        if IS_SQLSERVER:
            reviewer_name=db.scalar(select(User.full_name).where(User.id==u.reviewed_by_user_id)) if u.reviewed_by_user_id else None
            item.update(isActive=u.is_active, updatedAt=dt_value(u.updated_at), reviewedAt=dt_value(u.reviewed_at), reviewedBy=reviewer_name, reviewComment=u.review_comment)
        result.append(item)
    return result

class Approval(BaseModel):
    decision: Literal['approve','reject']
    assignedRole: Literal['Super User','Viewer'] = 'Viewer'

@app.post('/api/users/{user_id}/decision')
def decide(user_id: str, body: Approval, user=Depends(admin), db: DBSession=Depends(get_db)):
    if IS_SQLSERVER:
        target = db.get(User, int(user_id))
        if not target or target.status != 'Pending': fail(409, 'conflict')
        stamp = datetime.now(timezone.utc).replace(tzinfo=None)
        target.status = 'Approved' if body.decision == 'approve' else 'Rejected'
        target.role = db_role(body.assignedRole) if body.decision == 'approve' else 'User'
        target.is_active = body.decision == 'approve'
        target.reviewed_by_user_id = user.id
        target.reviewed_at = stamp
        target.review_comment = f"Account {body.decision}d by administrator."
        target.updated_at = stamp
    else:
        result = db.execute(update(User).where(User.id==user_id, User.status=='Pending Approval').values(status='Approved' if body.decision=='approve' else 'Rejected', role=body.assignedRole))
        if result.rowcount != 1: fail(409, 'conflict')
    db.commit(); return {'status':'saved'}

class FineInput(BaseModel):
    customerId: str = Field(min_length=1, max_length=30 if IS_SQLSERVER else 120)
    customerName: str = Field(default='', max_length=120)
    fineAmount: Decimal = Field(gt=0 if IS_SQLSERVER else None, ge=0, max_digits=18, decimal_places=2)
    status: Status = 'Pending'
    reasonCategory: str = Field(min_length=1, max_length=250 if IS_SQLSERVER else 200)
    fineDate: date
    sourceArea: Source
    orderReference: str = Field(default='', max_length=40 if IS_SQLSERVER else 120)
    currencyCode: Literal['USD'] = 'USD'
    @field_validator('customerId', 'reasonCategory')
    @classmethod
    def nonblank(cls, value):
        if not value.strip(): raise ValueError('Must not be blank')
        return value.strip()

    @field_validator('reasonCategory')
    @classmethod
    def valid_sql_reason(cls, value):
        allowed = {'Promotional / Contract Dispute','Labelling / Compliance','Incorrect Product','Missed Delivery Appointment','Quality Rejection','Pricing Discrepancy','Missing Documentation','Damaged Goods','Late Delivery','Short Delivery'}
        if IS_SQLSERVER and value not in allowed: raise ValueError('Select a supported fine reason.')
        return value

def output(fine):
    if IS_SQLSERVER:
        iso = lambda value: value.isoformat() if value else None
        return {
            'fineId': fine.id, 'customerId': fine.customer_id, 'customerName': fine.customer_name,
            'orderReference': fine.order_id, 'invoiceId': fine.invoice_id,
            'fineDate': fine.fine_date.isoformat(), 'fineAmount': float(fine.amount),
            'currencyCode': 'USD', 'reasonCategory': fine.reason, 'sourceArea': fine.source or 'Unknown',
            'status': fine.status, 'version': fine.version, 'createdAt': None,
            'updatedAt': iso(fine.updated_at), 'reasonDescription': fine.evidence_notes,
            'expectedDeliveryDate': iso(fine.promised_delivery_date), 'actualDeliveryDate': iso(fine.actual_delivery_date),
            'orderedQuantity': fine.ordered_qty, 'producedQuantity': fine.produced_qty,
            'dispatchedQuantity': fine.dispatched_qty, 'deliveredQuantity': fine.delivered_qty,
            'invoiceAmount': float(fine.invoice_amount),
            'financeStatus': fine.finance_status, 'amountReceived': float(fine.amount_received),
            'paymentDueDate': iso(fine.payment_due_date), 'retailerPaidAt': iso(fine.retailer_paid_at),
            'paymentReceivedAt': iso(fine.payment_received_at), 'paymentVerifiedAt': iso(fine.payment_verified_at),
        }
    return dict(fine.data, fineId=fine.id, status=fine.status, fineAmount=float(fine.amount), version=fine.version)

def make_fine(body):
    if IS_SQLSERVER:
        stamp = max(datetime.now(timezone.utc).replace(tzinfo=None), datetime.combine(body.fineDate, datetime.min.time()))
        ref = body.orderReference.strip() or f"APP-{uuid4().hex[:16]}"
        invoice = f"INV-{uuid4().hex[:16]}"
        return Fine(customer_id=body.customerId.strip(), customer_name=body.customerName.strip() or 'Unknown customer',
                    order_id=ref, invoice_id=invoice, fine_date=body.fineDate, amount=body.fineAmount,
                    reason=body.reasonCategory, source=body.sourceArea, status=body.status,
                    invoice_amount=body.fineAmount, amount_received=Decimal('0.00'),
                    finance_status='Unpaid', updated_at=stamp)
    data=body.model_dump(mode='json')
    data.update(createdAt=now(), updatedAt=now())
    return Fine(id=uid(), customer_id=body.customerId, amount=body.fineAmount, status=body.status, fine_date=body.fineDate.isoformat(), source=body.sourceArea, version=1, data=data)

def filtered(db, status=None, customerId=None, sourceArea=None, fromDate=None, toDate=None, reason=None, search=None):
    if fromDate and toDate and fromDate > toDate: fail(422, 'invalid-date-range')
    query=select(Fine)
    for column, value in [(Fine.status,status),(Fine.customer_id,customerId),(Fine.source,sourceArea)]:
        if value: query=query.where(column==value)
    if fromDate: query=query.where(Fine.fine_date>= (fromDate if IS_SQLSERVER else fromDate.isoformat()))
    if toDate: query=query.where(Fine.fine_date<= (toDate if IS_SQLSERVER else toDate.isoformat()))
    fine_rows=list(db.scalars(query.order_by(Fine.fine_date.desc(), Fine.id)))
    records=[output(f) for f in fine_rows]
    if IS_SQLSERVER and fine_rows:
        ids=[fine.id for fine in fine_rows]
        event_rows=db.execute(select(ActivityEvent.fine_id, ActivityEvent.created_at, ActivityEvent.comment, User.full_name)
                              .join(User, User.id==ActivityEvent.actor_user_id)
                              .where(ActivityEvent.fine_id.in_(ids), ActivityEvent.event_type=='Validation')
                              .order_by(ActivityEvent.created_at.desc()))
        latest={}
        for fine_id, reviewed_at, comment, reviewer_name in event_rows:
            latest.setdefault(fine_id, (reviewed_at, comment, reviewer_name))
        for record in records:
            if record['fineId'] in latest:
                reviewed_at, comment, reviewer_name=latest[record['fineId']]
                record.update(lastReviewedAt=dt_value(reviewed_at), lastReviewComment=comment, lastReviewerName=reviewer_name)
    if reason: records=[f for f in records if f['reasonCategory']==reason]
    if search:
        records=[f for f in records if search.lower() in ' '.join(str(f.get(k,'')) for k in ['fineId','customerId','customerName','orderReference']).lower()]
    return records

@app.get('/api/fines')
def fines(status: Optional[Status]=None, customerId: Optional[str]=None, sourceArea: Optional[SourceFilter]=None, fromDate: Optional[date]=None, toDate: Optional[date]=None, reason: Optional[str]=None, search: Optional[str]=Query(None,max_length=200), user=Depends(current), db: DBSession=Depends(get_db)):
    return filtered(db,status,customerId,sourceArea,fromDate,toDate,reason,search)

@app.get('/api/dashboard')
def dashboard(user=Depends(current), db: DBSession=Depends(get_db)):
    rows=filtered(db)
    sources=sorted({f['sourceArea'] or 'Unknown' for f in rows})
    result={'totalFines':len(rows), 'totalDeductions':float(sum(Decimal(str(f['fineAmount'])) for f in rows)), 'pendingCases':sum(f['status']=='Pending' for f in rows), 'deductionsBySource':{s:float(sum(Decimal(str(f['fineAmount'])) for f in rows if (f['sourceArea'] or 'Unknown')==s)) for s in sources}, 'currencyCode':'USD'}
    if IS_SQLSERVER:
        finance_rows=db.execute(select(Fine.finance_status, func.count(Fine.id), func.sum(Fine.invoice_amount), func.sum(Fine.amount_received)).group_by(Fine.finance_status)).all()
        result['financeByStatus']=[{'status':status,'count':count,'invoiceAmount':float(invoice or 0),'amountReceived':float(received or 0),'outstandingAmount':float((invoice or 0)-(received or 0))} for status,count,invoice,received in finance_rows]
        if app_role(user.role) == 'Super User':
            result['activityTotal']=db.scalar(select(func.count(ActivityEvent.id))) or 0
            recent_cutoff=datetime.now(timezone.utc).replace(tzinfo=None)-timedelta(days=30)
            result['activityLast30Days']=db.scalar(select(func.count(ActivityEvent.id)).where(ActivityEvent.created_at>=recent_cutoff)) or 0
            result['activityByType']=[{'type':event_type,'count':count} for event_type,count in db.execute(select(ActivityEvent.event_type,func.count(ActivityEvent.id)).group_by(ActivityEvent.event_type))]
            recent_events=list(db.scalars(select(ActivityEvent).order_by(ActivityEvent.created_at.desc(),ActivityEvent.id.desc()).limit(8)))
            event_user_ids={value for event in recent_events for value in (event.actor_user_id,event.target_user_id) if value is not None}
            event_users={uid:name for uid,name in db.execute(select(User.id,User.full_name).where(User.id.in_(event_user_ids))).all()} if event_user_ids else {}
            result['recentActivity']=[{'eventId':e.id,'fineId':e.fine_id,'targetUserId':e.target_user_id,'targetUserName':event_users.get(e.target_user_id),
                                       'actorUserId':e.actor_user_id,'actorName':event_users.get(e.actor_user_id,'Unknown user'),
                                       'eventType':e.event_type,'fieldName':e.field_name,'oldValue':e.old_value,'newValue':e.new_value,
                                       'comment':e.comment,'createdAt':dt_value(e.created_at)} for e in recent_events]
        if app_role(user.role) in ['Admin','Super User']:
            result['userTotal']=db.scalar(select(func.count(User.id))) or 0
            result['activeUsers']=db.scalar(select(func.count(User.id)).where(User.status=='Approved',User.is_active==1)) or 0
            result['pendingApprovals']=db.scalar(select(func.count(User.id)).where(User.status=='Pending')) or 0
            result['inactiveApprovedUsers']=db.scalar(select(func.count(User.id)).where(User.status=='Approved',User.is_active==0)) or 0
            result['activeUsersByRole']=[{'role':app_role(role),'count':count} for role,count in db.execute(select(User.role,func.count(User.id)).where(User.status=='Approved',User.is_active==1).group_by(User.role))]
    return result

@app.get('/api/activity-events')
def activity_events(offset: int=Query(0,ge=0), limit: int=Query(25,ge=1,le=100), eventType: Optional[Literal['Validation','Finance','Comment','DataEdit','UserManagement']]=None, fineId: Optional[str]=None, user=Depends(reviewer), db: DBSession=Depends(get_db)):
    if not IS_SQLSERVER: return {'items':[],'total':0,'offset':offset,'limit':limit}
    query=select(ActivityEvent)
    count_query=select(func.count(ActivityEvent.id))
    if eventType:
        query=query.where(ActivityEvent.event_type==eventType); count_query=count_query.where(ActivityEvent.event_type==eventType)
    if fineId:
        if not fineId.isdigit(): fail(422,'invalid-fine-id')
        query=query.where(ActivityEvent.fine_id==int(fineId)); count_query=count_query.where(ActivityEvent.fine_id==int(fineId))
    total=db.scalar(count_query) or 0
    events=list(db.scalars(query.order_by(ActivityEvent.created_at.desc(),ActivityEvent.id.desc()).offset(offset).limit(limit)))
    user_ids={value for event in events for value in (event.actor_user_id,event.target_user_id) if value is not None}
    users={uid:name for uid,name in db.execute(select(User.id,User.full_name).where(User.id.in_(user_ids))).all()} if user_ids else {}
    items=[{'eventId':e.id,'fineId':e.fine_id,'targetUserId':e.target_user_id,'targetUserName':users.get(e.target_user_id),
            'actorUserId':e.actor_user_id,'actorName':users.get(e.actor_user_id,'Unknown user'),
            'eventType':e.event_type,'fieldName':e.field_name,'oldValue':e.old_value,'newValue':e.new_value,
            'comment':e.comment,'createdAt':dt_value(e.created_at)} for e in events]
    return {'items':items,'total':total,'offset':offset,'limit':limit}

@app.post('/api/fines',status_code=201)
def create(body: FineInput, user=Depends(super_user), db: DBSession=Depends(get_db)):
    fine=make_fine(body); db.add(fine); db.commit(); db.refresh(fine); return output(fine)

@app.get('/api/fines/{fine_id}/reviews')
def reviews(fine_id: str, user=Depends(current), db: DBSession=Depends(get_db)):
    fine_key = int(fine_id) if IS_SQLSERVER and fine_id.isdigit() else fine_id
    if not db.get(Fine,fine_key): fail(404,'not-found')
    if IS_SQLSERVER:
        events = db.scalars(select(ActivityEvent).where(ActivityEvent.fine_id==fine_key, ActivityEvent.event_type=='Validation').order_by(ActivityEvent.created_at.desc()))
        return [{'reviewId':e.id,'fineId':e.fine_id,'oldStatus':e.old_value,'newStatus':e.new_value,
                 'reviewerId':e.actor_user_id,'reviewerName':(db.get(User,e.actor_user_id).full_name if db.get(User,e.actor_user_id) else 'Unknown reviewer'),
                 'comment':e.comment,'reviewedAt':dt_value(e.created_at)} for e in events]
    return sorted([r.data for r in db.scalars(select(Review).where(Review.fine_id==fine_key))],key=lambda r:r['reviewedAt'],reverse=True)

class Decision(BaseModel):
    decision: Status
    comment: str = Field(min_length=1,max_length=1000)
    expectedStatus: Status
    expectedVersion: int = Field(ge=1)
    @field_validator('comment')
    @classmethod
    def comment_required(cls,value):
        if not value.strip(): raise ValueError('Comment is required')
        return value.strip()

@app.post('/api/fines/{fine_id}/reviews')
def review(fine_id: str, body: Decision, user=Depends(reviewer), db: DBSession=Depends(get_db)):
    fine_key = int(fine_id) if IS_SQLSERVER and fine_id.isdigit() else fine_id
    fine=db.get(Fine,fine_key)
    if not fine: fail(404,'not-found')
    if str(fine.status).lower() != 'pending':
        fail(409,'review-only-pending-fines')
    if body.decision == 'Invalid' and not body.comment.strip():
        fail(422,'invalid-reason-required')
    stamp=now()
    if IS_SQLSERVER:
        if fine.status != body.expectedStatus or fine.version != body.expectedVersion: fail(409, 'conflict')
        old_row_version = fine.row_version
        stamp_dt = datetime.now(timezone.utc).replace(tzinfo=None)
        result=db.execute(update(Fine).where(Fine.id==fine_key,Fine.status==body.expectedStatus,Fine.row_version==old_row_version).values(status=body.decision,updated_at=stamp_dt))
        if result.rowcount != 1: db.rollback(); fail(409,'conflict')
        db.add(ActivityEvent(fine_id=fine_key, target_user_id=None, actor_user_id=user.id,
                             event_type='Validation', field_name='validation_status',
                             old_value=body.expectedStatus, new_value=body.decision, comment=body.comment,
                             created_at=stamp_dt))
        db.commit(); db.refresh(fine); return output(fine)
    data=dict(fine.data,updatedAt=stamp,lastReviewedAt=stamp,lastReviewerName=user.full_name,lastReviewComment=body.comment)
    result=db.execute(update(Fine).where(Fine.id==fine_key,Fine.version==body.expectedVersion,Fine.status==body.expectedStatus).values(status=body.decision,version=Fine.version+1,data=data))
    if result.rowcount!=1: db.rollback(); fail(409,'conflict')
    review_id=uid()
    db.add(Review(id=review_id,fine_id=fine_key,data={'reviewId':review_id,'fineId':fine_key,'oldStatus':body.expectedStatus,'newStatus':body.decision,'reviewerId':user.id,'reviewerName':user.full_name,'comment':body.comment,'reviewedAt':stamp}))
    db.commit(); db.refresh(fine); return output(fine)

@app.post('/api/imports/validate')
def import_excel(file: UploadFile=File(...), commit: bool=False, user=Depends(super_user), db: DBSession=Depends(get_db)):
    """Validate the complete workbook before any inserts. Explicit commit is required."""
    if not file.filename or not file.filename.lower().endswith('.xlsx'): fail(422,'xlsx-required')
    content=file.file.read(5*1024*1024+1)
    if len(content)>5*1024*1024: fail(413,'file-too-large')
    try:
        with ZipFile(io.BytesIO(content)) as archive:
            if sum(entry.file_size for entry in archive.infolist()) > 50*1024*1024:
                fail(413, 'workbook-expanded-size-too-large')
    except BadZipFile:
        fail(422, 'invalid-workbook')
    book = None
    try:
        book=load_workbook(io.BytesIO(content),read_only=True,data_only=True)
        sheet=book.active
        if sheet.max_row and sheet.max_row>10001: fail(422,'maximum-10000-rows')
        rows=sheet.iter_rows(values_only=True)
        headers=next(rows)
        required=['CustomerID','Fines Imposed','Status','Reason','Date','SourceArea']
        if len(set(headers)) != len(headers) or any(h not in headers for h in required): fail(422,{'requiredColumns':required})
        valid=[]; errors=[]
        for number,row in enumerate(rows,2):
            if number>10001: fail(422,'maximum-10000-rows')
            if all(v is None for v in row): continue
            values=dict(zip(headers,row))
            try:
                raw_date=values['Date']
                if isinstance(raw_date,datetime): raw_date=raw_date.date()
                valid.append(FineInput(customerId=str(values['CustomerID']) if values['CustomerID'] is not None else '',fineAmount=values['Fines Imposed'],status=values['Status'],reasonCategory=values['Reason'],fineDate=raw_date,sourceArea=values['SourceArea']))
            except (ValidationError,ValueError,TypeError) as error:
                errors.append({'row':number,'message':str(error)})
        book.close()
    except HTTPException: raise
    except Exception: fail(422,'invalid-workbook')
    finally:
        if book is not None: book.close()
    if errors: return {'valid':False,'imported':0,'errors':errors}
    if not valid: fail(422,'empty-workbook')
    if commit:
        # A content digest prevents the same file from being imported twice.
        digest=hashlib.sha256(content).hexdigest()
        db.add(ImportBatch(id=digest))
        db.add_all([make_fine(row) for row in valid])
        try: db.commit()
        except IntegrityError: db.rollback(); fail(409,'already-imported')
    return {'valid':True,'rows':len(valid),'imported':len(valid) if commit else 0,'errors':[]}

class ExportRequest(BaseModel):
    ids: list[str] = Field(min_length=1,max_length=10000)

@app.post('/api/exports/fines')
def export_fines(body: ExportRequest, user=Depends(exporter), db: DBSession=Depends(get_db)):
    from openpyxl import Workbook
    from fastapi.responses import StreamingResponse
    book=Workbook(); sheet=book.active; sheet.title='Fine Records'
    sheet.append(['Fine ID','Customer ID','Customer','Order Reference','Date','Fines Imposed','Currency','Reason','Source Area','Status','Latest Comment'])
    # Chunk IDs to stay within SQL Server's parameter limit.
    ids=list(dict.fromkeys(body.ids))
    if IS_SQLSERVER:
        try: ids=[int(value) for value in ids]
        except ValueError: fail(422, 'invalid-fine-id')
    for offset in range(0,len(ids),500):
        for fine in db.scalars(select(Fine).where(Fine.id.in_(ids[offset:offset+500]))):
            f=output(fine)
            sheet.append([f['fineId'],f['customerId'],f.get('customerName',''),f.get('orderReference',''),f['fineDate'],float(fine.amount),'USD',f['reasonCategory'],f['sourceArea'],f['status'],f.get('lastReviewComment','')])
            for cell in sheet[sheet.max_row]:
                if isinstance(cell.value,str): cell.data_type='s'
            sheet.cell(sheet.max_row,6).number_format='#,##0.00'
    sheet.freeze_panes='A2'; sheet.auto_filter.ref=sheet.dimensions
    from openpyxl.utils import get_column_letter
    for index in range(1,12): sheet.column_dimensions[get_column_letter(index)].width=24
    buffer=io.BytesIO(); book.save(buffer); buffer.seek(0)
    return StreamingResponse(buffer,media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',headers={'Content-Disposition':'attachment; filename="fines_export.xlsx"'})
