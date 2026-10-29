from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.db.models import Collection, Document
from app.schemas.collections import (
    CollectionCreate, CollectionUpdate, CollectionResponse
)

router = APIRouter(prefix="/collections", tags=["Collections"])

@router.get("", response_model=List[CollectionResponse])
def list_collections(db: Session = Depends(get_db)):
    collections = db.query(Collection).all()
    result = []
    for c in collections:
        doc_count = db.query(Document).filter(Document.collection_id == c.id).count()
        result.append(
            CollectionResponse(
                id=c.id,
                name=c.name,
                description=c.description,
                created_at=c.created_at,
                updated_at=c.updated_at,
                document_count=doc_count
            )
        )
    return result

@router.post("", response_model=CollectionResponse)
def create_collection(payload: CollectionCreate, db: Session = Depends(get_db)):
    existing = db.query(Collection).filter(Collection.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Collection '{payload.name}' already exists.")
    c = Collection(name=payload.name, description=payload.description)
    db.add(c)
    db.commit()
    db.refresh(c)
    return CollectionResponse(
        id=c.id,
        name=c.name,
        description=c.description,
        created_at=c.created_at,
        updated_at=c.updated_at,
        document_count=0
    )

@router.get("/{collection_id}", response_model=CollectionResponse)
def get_collection(collection_id: str, db: Session = Depends(get_db)):
    c = db.query(Collection).filter(Collection.id == collection_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Collection not found")
    doc_count = db.query(Document).filter(Document.collection_id == c.id).count()
    return CollectionResponse(
        id=c.id,
        name=c.name,
        description=c.description,
        created_at=c.created_at,
        updated_at=c.updated_at,
        document_count=doc_count
    )

@router.patch("/{collection_id}", response_model=CollectionResponse)
def update_collection(collection_id: str, payload: CollectionUpdate, db: Session = Depends(get_db)):
    c = db.query(Collection).filter(Collection.id == collection_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Collection not found")
    if payload.name:
        dup = db.query(Collection).filter(Collection.name == payload.name, Collection.id != collection_id).first()
        if dup:
            raise HTTPException(status_code=409, detail=f"Collection name '{payload.name}' already taken.")
        c.name = payload.name
    if payload.description is not None:
        c.description = payload.description
    db.commit()
    db.refresh(c)
    doc_count = db.query(Document).filter(Document.collection_id == c.id).count()
    return CollectionResponse(
        id=c.id,
        name=c.name,
        description=c.description,
        created_at=c.created_at,
        updated_at=c.updated_at,
        document_count=doc_count
    )

@router.delete("/{collection_id}")
def delete_collection(collection_id: str, db: Session = Depends(get_db)):
    c = db.query(Collection).filter(Collection.id == collection_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Collection not found")
    # Reset collection_id on associated documents
    db.query(Document).filter(Document.collection_id == collection_id).update({"collection_id": None})
    db.delete(c)
    db.commit()
    return {"success": True, "message": "Collection removed. Associated documents were unassigned."}
