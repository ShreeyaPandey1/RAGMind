class RAGMindException(Exception):
    """Base exception for RAGMind."""
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class DocumentProcessingError(RAGMindException):
    """Raised when document ingestion or parsing fails."""
    pass


class UnsupportedFileTypeError(RAGMindException):
    """Raised when file extension or MIME type is not allowed."""
    def __init__(self, message: str = "Unsupported file type"):
        super().__init__(message, status_code=415)


class DuplicateDocumentError(RAGMindException):
    """Raised when an identical document hash already exists."""
    def __init__(self, message: str = "A document with identical content already exists"):
        super().__init__(message, status_code=409)


class DocumentNotFoundError(RAGMindException):
    """Raised when requested document does not exist."""
    def __init__(self, message: str = "Document not found"):
        super().__init__(message, status_code=404)


class InsufficientEvidenceError(RAGMindException):
    """Raised or used when retrieval yields insufficient evidence."""
    pass


class LLMServiceError(RAGMindException):
    """Raised when AI provider call fails or times out."""
    def __init__(self, message: str = "AI service provider error", status_code: int = 502):
        super().__init__(message, status_code=status_code)
