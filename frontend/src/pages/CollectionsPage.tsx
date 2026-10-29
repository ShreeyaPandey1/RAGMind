import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen,
  FolderPlus,
  Trash2,
  Edit2,
  FileText,
  ArrowRight
} from 'lucide-react';
import { collectionsApi } from '../api/client';
import { CollectionItem } from '../types';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Modal } from '../components/common/Modal';
import { formatDate } from './DashboardPage';
import { EmptyState } from '../components/common/EmptyState';

export const CollectionsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<CollectionItem | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [collToDelete, setCollToDelete] = useState<CollectionItem | null>(null);

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['collectionsList'],
    queryFn: collectionsApi.list,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editingCollection) {
        return collectionsApi.update(editingCollection.id, { name, description });
      }
      return collectionsApi.create({ name, description });
    },
    onSuccess: () => {
      setIsModalOpen(false);
      setEditingCollection(null);
      setName('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['collectionsList'] });
    },
    onError: (err: Error) => {
      alert('Error saving collection: ' + err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => collectionsApi.delete(id),
    onSuccess: () => {
      setCollToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['collectionsList'] });
    },
    onError: (err: Error) => {
      alert('Error deleting collection: ' + err.message);
    },
  });

  const openCreateModal = () => {
    setEditingCollection(null);
    setName('');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (c: CollectionItem) => {
    setEditingCollection(c);
    setName(c.name);
    setDescription(c.description || '');
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            Document Collections
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Organize documents into thematic knowledge bases to scope retrieval queries.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreateModal} className="gap-1.5 shadow-sm">
          <FolderPlus className="w-4 h-4" />
          New Collection
        </Button>
      </div>

      {collections.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No collections created"
          description="Group your documents into collections to focus chat queries on specific topics."
          actionLabel="Create Collection"
          onAction={openCreateModal}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {collections.map(c => (
            <Card key={c.id} className="p-5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditModal(c)} className="h-7 w-7 text-muted-foreground">
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setCollToDelete(c)} className="h-7 w-7 text-muted-foreground hover:text-rose-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-foreground">{c.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                    {c.description || 'No description provided.'}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  {c.document_count ?? 0} {c.document_count === 1 ? 'document' : 'documents'}
                </span>
                <span className="text-[11px]">{formatDate(c.created_at)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCollection ? 'Edit Collection' : 'Create Collection'}
      >
        <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Collection Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Legal Briefs, Machine Learning Papers"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Description (Optional)</label>
            <textarea
              rows={3}
              placeholder="Purpose or contents of this collection..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={saveMutation.isPending} disabled={!name.trim()}>
              {editingCollection ? 'Save Changes' : 'Create Collection'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={Boolean(collToDelete)}
        onClose={() => setCollToDelete(null)}
        title="Delete Collection"
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Delete collection <span className="font-semibold text-foreground">{collToDelete?.name}</span>?
            The documents inside will remain in your library as unassigned.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setCollToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={deleteMutation.isPending}
              onClick={() => collToDelete && deleteMutation.mutate(collToDelete.id)}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
