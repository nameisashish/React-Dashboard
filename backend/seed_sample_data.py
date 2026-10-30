"""Add idempotent sample fine records to the configured local database."""
from datetime import date, timedelta
from decimal import Decimal
import random

from sqlalchemy import select

from database import Base, SessionLocal, engine
from main import FineInput, make_fine
from models import Fine


ROWS_PER_SOURCE = 1000
SOURCES = ("Logistics", "Warehouse", "Manufacturing")
REASONS = {
    "Logistics": ("Late delivery", "Missing proof of delivery", "Damaged in transit", "Route deviation"),
    "Warehouse": ("Inventory discrepancy", "Picking error", "Storage damage", "Packaging issue"),
    "Manufacturing": ("Production defect", "Quality inspection failure", "Material waste", "Line stoppage"),
}
STATUSES = ("Pending", "Valid", "Invalid")


def main():
    if engine.dialect.name != "sqlite":
        raise SystemExit("Sample data seeding is restricted to SQLite; SQL Server was not changed.")
    Base.metadata.create_all(engine)
    rng = random.Random(20261030)
    today = date.today()
    inserted = 0
    with SessionLocal() as db:
        existing = {
            record.get("orderReference", "")
            for record in db.scalars(select(Fine.data))
            if record.get("orderReference", "").startswith("SAMPLE-")
        }
        rows = []
        for source in SOURCES:
            for number in range(1, ROWS_PER_SOURCE + 1):
                order_ref = f"SAMPLE-{source.upper()}-{number:04d}"
                if order_ref in existing:
                    continue
                status = rng.choices(STATUSES, weights=(25, 55, 20), k=1)[0]
                fine_date = today - timedelta(days=rng.randrange(365))
                amount = Decimal(rng.randrange(2500, 500001)) / 100
                customer_number = rng.randrange(1, 251)
                rows.append(make_fine(FineInput(
                    customerId=f"CUST-{customer_number:04d}",
                    customerName=f"Sample Customer {customer_number:03d}",
                    fineAmount=amount,
                    status=status,
                    reasonCategory=rng.choice(REASONS[source]),
                    fineDate=fine_date,
                    sourceArea=source,
                    orderReference=order_ref,
                )))
        db.add_all(rows)
        db.commit()
        inserted = len(rows)
    print(f"Added {inserted} sample rows. Existing app records and accounts were preserved.")
    print("Sample rows are identified by order references beginning with SAMPLE-.")


if __name__ == "__main__":
    main()
