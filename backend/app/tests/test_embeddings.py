from app.services.embeddings import EmbeddingService

def test_local_embedding_service_dimensions():
    service = EmbeddingService(provider="local", dimensions=1536)
    vec = service.get_query_embedding("What is RAGMind?")
    
    assert isinstance(vec, list)
    assert len(vec) == 1536
    # Check normalized
    sum_sq = sum(x**2 for x in vec)
    assert 0.99 <= sum_sq <= 1.01

def test_local_embedding_batch():
    service = EmbeddingService(provider="local", dimensions=512)
    texts = ["Document chunk one", "Document chunk two", "Another topic entirely"]
    vectors = service.get_embeddings_batch(texts)

    assert len(vectors) == 3
    assert len(vectors[0]) == 512
    assert len(vectors[1]) == 512
    assert len(vectors[2]) == 512
