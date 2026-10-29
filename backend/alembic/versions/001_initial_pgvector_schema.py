"""Initial pgvector schema

Revision ID: 001_initial_pgvector_schema
Revises: 
Create Date: 2026-10-29 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Enable pgvector extension if postgresql
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # 2. Collections table
    op.create_table(
        'collections',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False, unique=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_collections_name', 'collections', ['name'])

    # 3. Documents table
    op.create_table(
        'documents',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('content_hash', sa.String(length=64), nullable=False),
        sa.Column('storage_path', sa.String(length=500), nullable=False),
        sa.Column('processing_status', sa.String(length=50), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('extracted_page_count', sa.Integer(), server_default='0'),
        sa.Column('chunk_count', sa.Integer(), server_default='0'),
        sa.Column('collection_id', sa.String(length=36), sa.ForeignKey('collections.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_documents_content_hash', 'documents', ['content_hash'])
    op.create_index('ix_documents_processing_status', 'documents', ['processing_status'])

    # 4. Document Chunks table
    if bind.dialect.name == "postgresql":
        from pgvector.sqlalchemy import Vector
        vector_col = sa.Column('embedding', Vector(1536), nullable=True)
    else:
        vector_col = sa.Column('embedding', sa.Text(), nullable=True)

    op.create_table(
        'document_chunks',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('document_id', sa.String(length=36), sa.ForeignKey('documents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        vector_col,
        sa.Column('page_number', sa.Integer(), nullable=True),
        sa.Column('section_metadata', sa.String(length=255), nullable=True),
        sa.Column('char_offset_start', sa.Integer(), nullable=True),
        sa.Column('char_offset_end', sa.Integer(), nullable=True),
        sa.Column('token_count', sa.Integer(), server_default='0'),
        sa.Column('metadata_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_document_chunks_document_id', 'document_chunks', ['document_id'])

    # If postgresql, create HNSW vector index
    if bind.dialect.name == "postgresql":
        op.execute("CREATE INDEX IF NOT EXISTS ix_chunks_embedding_hnsw ON document_chunks USING hnsw (embedding vector_cosine_ops);")

    # 5. Conversations table
    op.create_table(
        'conversations',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('document_scope_type', sa.String(length=50), server_default='ALL'),
        sa.Column('selected_scope_ids', sa.Text(), server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # 6. Messages table
    op.create_table(
        'messages',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('conversation_id', sa.String(length=36), sa.ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_abstention', sa.Boolean(), server_default='0'),
        sa.Column('retrieval_diagnostics', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_messages_conversation_id', 'messages', ['conversation_id'])

    # 7. Answer Sources table
    op.create_table(
        'answer_sources',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('message_id', sa.String(length=36), sa.ForeignKey('messages.id', ondelete='CASCADE'), nullable=False),
        sa.Column('chunk_id', sa.String(length=36), sa.ForeignKey('document_chunks.id', ondelete='SET NULL'), nullable=True),
        sa.Column('citation_number', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.String(length=36), nullable=False),
        sa.Column('document_name', sa.String(length=255), nullable=False),
        sa.Column('page_number', sa.Integer(), nullable=True),
        sa.Column('relevance_score', sa.Float(), nullable=False),
        sa.Column('excerpt', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_answer_sources_message_id', 'answer_sources', ['message_id'])
    op.create_index('ix_answer_sources_chunk_id', 'answer_sources', ['chunk_id'])

def downgrade() -> None:
    op.drop_table('answer_sources')
    op.drop_table('messages')
    op.drop_table('conversations')
    op.drop_table('document_chunks')
    op.drop_table('documents')
    op.drop_table('collections')
