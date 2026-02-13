import { BsPlus, BsPencil } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';
import {
  Component,
  createSignal,
  onMount,
  Show,
  For,
  onCleanup,
} from 'solid-js';

import {
  Button,
  IconButton,
  ConfirmDialog,
  Modal,
  TagBadge,
  TagsService,
  Tag,
  TagGroup,
  ToastProvider,
  useToast,
  FormItem,
  TAG_COLOR_PALETTE,
} from '@castmill/ui-common';

import {
  AddonStore,
  AddonComponentProps,
} from '../../common/interfaces/addon-store';

interface TagFormData {
  name: string;
  color: string;
  tag_group_id?: number | null;
}

const TagsPage: Component<AddonComponentProps> = (props) => {
  const t = (key: string, params?: Record<string, any>) =>
    props.store.i18n?.t(key, params) || key;
  const toast = useToast();

  // Permission check: only admin and manager can create/edit/delete tags
  const canManageTags = () => {
    const role = props.store.permissions?.role;
    return role === 'admin' || role === 'manager';
  };

  // Tags state
  const [tags, setTags] = createSignal<Tag[]>([]);
  const [tagGroups, setTagGroups] = createSignal<TagGroup[]>([]);
  const [loading, setLoading] = createSignal(true);

  // Modal states
  const [showTagModal, setShowTagModal] = createSignal(false);
  const [editingTag, setEditingTag] = createSignal<Tag | null>(null);
  const [showGroupModal, setShowGroupModal] = createSignal(false);
  const [editingGroup, setEditingGroup] = createSignal<TagGroup | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = createSignal<Tag | null>(
    null
  );
  const [showConfirmDeleteGroup, setShowConfirmDeleteGroup] =
    createSignal<TagGroup | null>(null);

  // Form state
  const [tagFormData, setTagFormData] = createSignal<TagFormData>({
    name: '',
    color: TAG_COLOR_PALETTE[0],
    tag_group_id: null,
  });
  const [groupFormData, setGroupFormData] = createSignal({
    name: '',
    color: TAG_COLOR_PALETTE[0],
  });

  // Initialize TagsService
  const tagsService = new TagsService(props.store.env.baseUrl);

  const loadData = async () => {
    if (!props.store.organizations.selectedId) return;

    setLoading(true);
    try {
      const [tagsResult, groupsResult] = await Promise.all([
        tagsService.listTags(props.store.organizations.selectedId),
        tagsService.listTagGroups(props.store.organizations.selectedId),
      ]);
      setTags(tagsResult);
      setTagGroups(groupsResult);
    } catch (error) {
      console.error('Failed to load tags:', error);
      toast.error(t('tags.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadData();
  });

  // Get tags organized by group
  const tagsWithoutGroup = () => tags().filter((tag) => !tag.tag_group_id);

  const tagsByGroup = (groupId: number) =>
    tags().filter((tag) => tag.tag_group_id === groupId);

  // Tag CRUD operations
  const openCreateTag = (groupId?: number) => {
    setEditingTag(null);
    setTagFormData({
      name: '',
      color:
        TAG_COLOR_PALETTE[Math.floor(Math.random() * TAG_COLOR_PALETTE.length)],
      tag_group_id: groupId ?? null,
    });
    setShowTagModal(true);
  };

  const openEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setTagFormData({
      name: tag.name,
      color: tag.color,
      tag_group_id: tag.tag_group_id ?? null,
    });
    setShowTagModal(true);
  };

  const handleTagSubmit = async (e: Event) => {
    e.preventDefault();

    try {
      const data = tagFormData();
      if (editingTag()) {
        const updated = await tagsService.updateTag(
          props.store.organizations.selectedId,
          editingTag()!.id,
          data
        );
        setTags(tags().map((t) => (t.id === updated.id ? updated : t)));
        toast.success(t('tags.updateSuccess'));
      } else {
        const created = await tagsService.createTag(
          props.store.organizations.selectedId,
          data
        );
        setTags([...tags(), created]);
        toast.success(t('tags.createSuccess'));
      }
      setShowTagModal(false);
    } catch (error) {
      console.error('Failed to save tag:', error);
      toast.error(
        editingTag()
          ? t('tags.errors.updateFailed')
          : t('tags.errors.createFailed')
      );
    }
  };

  const handleDeleteTag = async (tag: Tag) => {
    try {
      await tagsService.deleteTag(props.store.organizations.selectedId, tag.id);
      setTags(tags().filter((t) => t.id !== tag.id));
      toast.success(t('tags.deleteSuccess'));
    } catch (error) {
      console.error('Failed to delete tag:', error);
      toast.error(t('tags.errors.deleteFailed'));
    }
    setShowConfirmDelete(null);
  };

  // Group CRUD operations
  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupFormData({
      name: '',
      color:
        TAG_COLOR_PALETTE[Math.floor(Math.random() * TAG_COLOR_PALETTE.length)],
    });
    setShowGroupModal(true);
  };

  const openEditGroup = (group: TagGroup) => {
    setEditingGroup(group);
    setGroupFormData({
      name: group.name,
      color: group.color || TAG_COLOR_PALETTE[0],
    });
    setShowGroupModal(true);
  };

  const handleGroupSubmit = async (e: Event) => {
    e.preventDefault();

    try {
      const data = groupFormData();
      if (editingGroup()) {
        const updated = await tagsService.updateTagGroup(
          props.store.organizations.selectedId,
          editingGroup()!.id,
          data
        );
        setTagGroups(
          tagGroups().map((g) => (g.id === updated.id ? updated : g))
        );
        toast.success(t('tags.groups.updateSuccess'));
      } else {
        const created = await tagsService.createTagGroup(
          props.store.organizations.selectedId,
          data
        );
        setTagGroups([...tagGroups(), created]);
        toast.success(t('tags.groups.createSuccess'));
      }
      setShowGroupModal(false);
    } catch (error) {
      console.error('Failed to save tag group:', error);
      toast.error(
        editingGroup()
          ? t('tags.groups.errors.updateFailed')
          : t('tags.groups.errors.createFailed')
      );
    }
  };

  const handleDeleteGroup = async (group: TagGroup) => {
    try {
      await tagsService.deleteTagGroup(
        props.store.organizations.selectedId,
        group.id
      );
      setTagGroups(tagGroups().filter((g) => g.id !== group.id));
      // Also update tags that were in this group
      setTags(
        tags().map((tag) =>
          tag.tag_group_id === group.id ? { ...tag, tag_group_id: null } : tag
        )
      );
      toast.success(t('tags.groups.deleteSuccess'));
    } catch (error) {
      console.error('Failed to delete tag group:', error);
      toast.error(t('tags.groups.errors.deleteFailed'));
    }
    setShowConfirmDeleteGroup(null);
  };

  return (
    <div class="tags-page">
      <div class="tags-header">
        <h1>{t('tags.title')}</h1>
        <Show when={canManageTags()}>
          <div class="header-actions">
            <Button
              label={t('tags.groups.create')}
              onClick={openCreateGroup}
              color="secondary"
            />
            <Button
              label={t('tags.create')}
              onClick={() => openCreateTag()}
              icon={BsPlus}
              color="primary"
            />
          </div>
        </Show>
      </div>

      <Show when={loading()}>
        <div class="loading">{t('common.loading')}</div>
      </Show>

      <Show when={!loading()}>
        {/* Tags without group */}
        <div class="tags-section">
          <h2>{t('tags.ungroupedTags')}</h2>
          <div class="tags-grid">
            <For each={tagsWithoutGroup()}>
              {(tag) => (
                <div class="tag-item">
                  <TagBadge tag={tag} />
                  <Show when={canManageTags()}>
                    <div class="tag-actions">
                      <IconButton
                        icon={BsPencil}
                        onClick={() => openEditTag(tag)}
                        color="secondary"
                        size="small"
                      />
                      <IconButton
                        icon={AiOutlineDelete}
                        onClick={() => setShowConfirmDelete(tag)}
                        color="danger"
                        size="small"
                      />
                    </div>
                  </Show>
                </div>
              )}
            </For>
            <Show when={tagsWithoutGroup().length === 0}>
              <p class="empty-message">{t('tags.noUngroupedTags')}</p>
            </Show>
          </div>
        </div>

        {/* Tag Groups */}
        <For each={tagGroups()}>
          {(group) => (
            <div class="tags-section tag-group">
              <div class="group-header">
                <h2 style={`border-left: 4px solid ${group.color || '#ccc'};`}>
                  {group.name}
                </h2>
                <Show when={canManageTags()}>
                  <div class="group-actions">
                    <IconButton
                      icon={BsPlus}
                      onClick={() => openCreateTag(group.id)}
                      color="primary"
                      size="small"
                    />
                    <IconButton
                      icon={BsPencil}
                      onClick={() => openEditGroup(group)}
                      color="secondary"
                      size="small"
                    />
                    <IconButton
                      icon={AiOutlineDelete}
                      onClick={() => setShowConfirmDeleteGroup(group)}
                      color="danger"
                      size="small"
                    />
                  </div>
                </Show>
              </div>
              <div class="tags-grid">
                <For each={tagsByGroup(group.id)}>
                  {(tag) => (
                    <div class="tag-item">
                      <TagBadge tag={tag} />
                      <Show when={canManageTags()}>
                        <div class="tag-actions">
                          <IconButton
                            icon={BsPencil}
                            onClick={() => openEditTag(tag)}
                            color="secondary"
                            size="small"
                          />
                          <IconButton
                            icon={AiOutlineDelete}
                            onClick={() => setShowConfirmDelete(tag)}
                            color="danger"
                            size="small"
                          />
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
                <Show when={tagsByGroup(group.id).length === 0}>
                  <p class="empty-message">{t('tags.noTagsInGroup')}</p>
                </Show>
              </div>
            </div>
          )}
        </For>

        <Show when={tags().length === 0 && tagGroups().length === 0}>
          <div class="empty-state">
            <p>{t('tags.emptyState')}</p>
            <Show when={canManageTags()}>
              <Button
                label={t('tags.create')}
                onClick={() => openCreateTag()}
                icon={BsPlus}
                color="primary"
              />
            </Show>
          </div>
        </Show>
      </Show>

      {/* Tag Modal */}
      <Show when={showTagModal()}>
        <Modal
          title={editingTag() ? t('tags.edit') : t('tags.create')}
          onClose={() => setShowTagModal(false)}
        >
          <form onSubmit={handleTagSubmit} class="tag-form">
            <FormItem
              label={t('common.name')}
              id="tag-name"
              value={tagFormData().name}
              placeholder={t('tags.namePlaceholder')}
              onInput={(value: string) =>
                setTagFormData({ ...tagFormData(), name: value })
              }
            />

            <div class="color-picker">
              <label>{t('tags.colorPicker')}</label>
              <div class="color-options">
                <For each={TAG_COLOR_PALETTE}>
                  {(color) => (
                    <button
                      type="button"
                      class={`color-option ${tagFormData().color === color ? 'selected' : ''}`}
                      style={`background-color: ${color};`}
                      onClick={() =>
                        setTagFormData({ ...tagFormData(), color })
                      }
                    />
                  )}
                </For>
              </div>
            </div>

            <Show when={tagGroups().length > 0}>
              <div class="form-field">
                <label>{t('tags.groups.selectGroup')}</label>
                <select
                  value={tagFormData().tag_group_id?.toString() || ''}
                  onChange={(e) =>
                    setTagFormData({
                      ...tagFormData(),
                      tag_group_id: e.currentTarget.value
                        ? parseInt(e.currentTarget.value)
                        : null,
                    })
                  }
                >
                  <option value="">{t('tags.groups.noGroup')}</option>
                  <For each={tagGroups()}>
                    {(group) => <option value={group.id}>{group.name}</option>}
                  </For>
                </select>
              </div>
            </Show>

            <div class="form-actions">
              <Button
                label={t('common.cancel')}
                onClick={() => setShowTagModal(false)}
                color="secondary"
              />
              <Button
                label={editingTag() ? t('common.save') : t('common.create')}
                type="submit"
                color="primary"
                disabled={!tagFormData().name.trim()}
              />
            </div>
          </form>
        </Modal>
      </Show>

      {/* Group Modal */}
      <Show when={showGroupModal()}>
        <Modal
          title={
            editingGroup() ? t('tags.groups.edit') : t('tags.groups.create')
          }
          onClose={() => setShowGroupModal(false)}
        >
          <form onSubmit={handleGroupSubmit} class="tag-form">
            <FormItem
              label={t('common.name')}
              id="group-name"
              value={groupFormData().name}
              placeholder={t('tags.groups.namePlaceholder')}
              onInput={(value: string) =>
                setGroupFormData({ ...groupFormData(), name: value })
              }
            />

            <div class="color-picker">
              <label>{t('tags.colorPicker')}</label>
              <div class="color-options">
                <For each={TAG_COLOR_PALETTE}>
                  {(color) => (
                    <button
                      type="button"
                      class={`color-option ${groupFormData().color === color ? 'selected' : ''}`}
                      style={`background-color: ${color};`}
                      onClick={() =>
                        setGroupFormData({ ...groupFormData(), color })
                      }
                    />
                  )}
                </For>
              </div>
            </div>

            <div class="form-actions">
              <Button
                label={t('common.cancel')}
                onClick={() => setShowGroupModal(false)}
                color="secondary"
              />
              <Button
                label={editingGroup() ? t('common.save') : t('common.create')}
                type="submit"
                color="primary"
                disabled={!groupFormData().name.trim()}
              />
            </div>
          </form>
        </Modal>
      </Show>

      {/* Delete Confirmations */}
      <ConfirmDialog
        show={!!showConfirmDelete()}
        title={t('tags.confirmDelete')}
        message={t('tags.confirmDeleteMessage', {
          name: showConfirmDelete()?.name,
        })}
        onClose={() => setShowConfirmDelete(null)}
        onConfirm={() =>
          showConfirmDelete() && handleDeleteTag(showConfirmDelete()!)
        }
      />

      <ConfirmDialog
        show={!!showConfirmDeleteGroup()}
        title={t('tags.groups.confirmDelete')}
        message={t('tags.groups.confirmDeleteMessage', {
          name: showConfirmDeleteGroup()?.name,
        })}
        onClose={() => setShowConfirmDeleteGroup(null)}
        onConfirm={() =>
          showConfirmDeleteGroup() &&
          handleDeleteGroup(showConfirmDeleteGroup()!)
        }
      />
    </div>
  );
};

export default (props: any) => (
  <ToastProvider>
    <TagsPage {...props} />
  </ToastProvider>
);
