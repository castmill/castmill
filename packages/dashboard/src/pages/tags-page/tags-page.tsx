import { BsPlus, BsPencil } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';
import { Component, createSignal, createEffect, Show, For } from 'solid-js';

import {
  Button,
  IconButton,
  ConfirmDialog,
  Modal,
  TagBadge,
  TagsService,
  Tag,
  TagGroup,
  useToast,
  FormItem,
  TAG_COLOR_PALETTE,
  Dropdown,
} from '@castmill/ui-common';

import { store } from '../../store/store';
import { useI18n } from '../../i18n';
import { usePermissions } from '../../hooks/usePermissions';
import { baseUrl } from '../../env';

import styles from './tags-page.module.scss';

interface TagFormData {
  name: string;
  color: string;
  tag_group_id?: number | null;
}

const TagsPage: Component = () => {
  const { t } = useI18n();
  const { hasAnyRole } = usePermissions();
  const toast = useToast();

  const canManageTags = () => hasAnyRole(['admin', 'manager']);

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
    color: TAG_COLOR_PALETTE[0] as string,
    tag_group_id: null,
  });
  const [groupFormData, setGroupFormData] = createSignal<{
    name: string;
    color: string;
  }>({
    name: '',
    color: TAG_COLOR_PALETTE[0] as string,
  });

  const tagsService = new TagsService(baseUrl);

  const loadData = async () => {
    const orgId = store.organizations.selectedId;
    if (!orgId) return;

    setLoading(true);
    try {
      const [tagsResult, groupsResult] = await Promise.all([
        tagsService.listTags(orgId),
        tagsService.listTagGroups(orgId),
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

  // Reload data when organization changes
  createEffect(() => {
    const orgId = store.organizations.selectedId;
    if (orgId) {
      loadData();
    }
  });

  // Get tags organized by group
  const tagsWithoutGroup = () => tags().filter((tag) => !tag.tag_group_id);

  const tagsByGroup = (groupId: number) =>
    tags().filter((tag) => tag.tag_group_id === groupId);

  // Tag CRUD operations
  const openCreateTag = (groupId?: number) => {
    setEditingTag(null);
    const group = groupId ? tagGroups().find((g) => g.id === groupId) : null;
    setTagFormData({
      name: '',
      color:
        group?.color ||
        (TAG_COLOR_PALETTE[
          Math.floor(Math.random() * TAG_COLOR_PALETTE.length)
        ] as string),
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
    const orgId = store.organizations.selectedId;
    if (!orgId) return;

    try {
      const data = tagFormData();
      if (editingTag()) {
        const updated = await tagsService.updateTag(
          orgId,
          editingTag()!.id,
          data
        );
        setTags(tags().map((t) => (t.id === updated.id ? updated : t)));
        toast.success(t('tags.messages.tagUpdated', { name: updated.name }));
      } else {
        const created = await tagsService.createTag(orgId, data);
        setTags([...tags(), created]);
        toast.success(t('tags.messages.tagCreated', { name: created.name }));
      }
      setShowTagModal(false);
    } catch (error) {
      console.error('Failed to save tag:', error);
      toast.error(
        editingTag()
          ? t('tags.errors.updateTag', { error: String(error) })
          : t('tags.errors.createTag', { error: String(error) })
      );
    }
  };

  const handleDeleteTag = async (tag: Tag) => {
    const orgId = store.organizations.selectedId;
    if (!orgId) return;

    try {
      await tagsService.deleteTag(orgId, tag.id);
      setTags(tags().filter((t) => t.id !== tag.id));
      toast.success(t('tags.messages.tagDeleted', { name: tag.name }));
    } catch (error) {
      console.error('Failed to delete tag:', error);
      toast.error(t('tags.errors.deleteTag', { error: String(error) }));
    }
    setShowConfirmDelete(null);
  };

  // Group CRUD operations
  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupFormData({
      name: '',
      color: TAG_COLOR_PALETTE[
        Math.floor(Math.random() * TAG_COLOR_PALETTE.length)
      ] as string,
    });
    setShowGroupModal(true);
  };

  const openEditGroup = (group: TagGroup) => {
    setEditingGroup(group);
    setGroupFormData({
      name: group.name,
      color: group.color || (TAG_COLOR_PALETTE[0] as string),
    });
    setShowGroupModal(true);
  };

  const handleGroupSubmit = async (e: Event) => {
    e.preventDefault();
    const orgId = store.organizations.selectedId;
    if (!orgId) return;

    try {
      const data = groupFormData();
      if (editingGroup()) {
        const updated = await tagsService.updateTagGroup(
          orgId,
          editingGroup()!.id,
          data
        );
        setTagGroups(
          tagGroups().map((g) => (g.id === updated.id ? updated : g))
        );
        toast.success(t('tags.messages.groupUpdated', { name: updated.name }));
      } else {
        const created = await tagsService.createTagGroup(orgId, data);
        setTagGroups([...tagGroups(), created]);
        toast.success(t('tags.messages.groupCreated', { name: created.name }));
      }
      setShowGroupModal(false);
    } catch (error) {
      console.error('Failed to save tag group:', error);
      toast.error(
        editingGroup()
          ? t('tags.errors.updateGroup', { error: String(error) })
          : t('tags.errors.createGroup', { error: String(error) })
      );
    }
  };

  const handleDeleteGroup = async (group: TagGroup) => {
    const orgId = store.organizations.selectedId;
    if (!orgId) return;

    try {
      await tagsService.deleteTagGroup(orgId, group.id);
      setTagGroups(tagGroups().filter((g) => g.id !== group.id));
      // Tags in this group are cascade-deleted by the database
      setTags(tags().filter((tag) => tag.tag_group_id !== group.id));
      toast.success(t('tags.messages.groupDeleted', { name: group.name }));
    } catch (error) {
      console.error('Failed to delete tag group:', error);
      toast.error(t('tags.errors.deleteGroup', { error: String(error) }));
    }
    setShowConfirmDeleteGroup(null);
  };

  return (
    <div class={styles['tags-page']}>
      <div class={styles['tags-header']}>
        <h1>{t('tags.title')}</h1>
        <Show when={canManageTags()}>
          <div class={styles['header-actions']}>
            <Button
              label={t('tags.groups.addGroup')}
              onClick={openCreateGroup}
              color="primary"
              data-onboarding="create-tag-group"
            />
            <Button
              label={t('tags.createTag')}
              onClick={() => openCreateTag()}
              icon={BsPlus}
              color="primary"
            />
          </div>
        </Show>
      </div>

      <Show when={loading()}>
        <div class={styles.loading}>{t('common.loading')}</div>
      </Show>

      <Show when={!loading()}>
        {/* Tags without group */}
        <div class={styles['tags-section']}>
          <h2>{t('tags.groups.ungrouped')}</h2>
          <div class={styles['tags-grid']}>
            <For each={tagsWithoutGroup()}>
              {(tag) => (
                <div class={styles['tag-item']}>
                  <TagBadge tag={tag} />
                  <Show when={canManageTags()}>
                    <div class={styles['tag-actions']}>
                      <IconButton
                        icon={BsPencil}
                        onClick={() => openEditTag(tag)}
                        color="secondary"
                      />
                      <IconButton
                        icon={AiOutlineDelete}
                        onClick={() => setShowConfirmDelete(tag)}
                        color="danger"
                      />
                    </div>
                  </Show>
                </div>
              )}
            </For>
            <Show when={tagsWithoutGroup().length === 0}>
              <p class={styles['empty-message']}>{t('tags.noTags')}</p>
            </Show>
          </div>
        </div>

        {/* Tag Groups */}
        <For each={tagGroups()}>
          {(group) => (
            <div
              class={`${styles['tags-section']} ${styles['tag-group']}`}
              style={{ '--group-accent': group.color || 'transparent' }}
            >
              <div class={styles['group-header']}>
                <h2>
                  {group.name}
                  <span class={styles['group-tag-count']}>
                    {tagsByGroup(group.id).length}
                  </span>
                </h2>
                <Show when={canManageTags()}>
                  <div class={styles['group-actions']}>
                    <IconButton
                      icon={BsPlus}
                      onClick={() => openCreateTag(group.id)}
                      color="primary"
                    />
                    <IconButton
                      icon={BsPencil}
                      onClick={() => openEditGroup(group)}
                      color="secondary"
                    />
                    <IconButton
                      icon={AiOutlineDelete}
                      onClick={() => setShowConfirmDeleteGroup(group)}
                      color="danger"
                    />
                  </div>
                </Show>
              </div>
              <div class={styles['tags-grid']}>
                <For each={tagsByGroup(group.id)}>
                  {(tag) => (
                    <div class={styles['tag-item']}>
                      <TagBadge tag={tag} />
                      <Show when={canManageTags()}>
                        <div class={styles['tag-actions']}>
                          <IconButton
                            icon={BsPencil}
                            onClick={() => openEditTag(tag)}
                            color="secondary"
                          />
                          <IconButton
                            icon={AiOutlineDelete}
                            onClick={() => setShowConfirmDelete(tag)}
                            color="danger"
                          />
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
                <Show when={tagsByGroup(group.id).length === 0}>
                  <p class={styles['empty-message']}>{t('tags.noTags')}</p>
                </Show>
              </div>
            </div>
          )}
        </For>

        <Show when={tags().length === 0 && tagGroups().length === 0}>
          <div class={styles['empty-state']}>
            <p>{t('tags.noTagsAvailable')}</p>
            <Show when={canManageTags()}>
              <Button
                label={t('tags.createTag')}
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
          title={editingTag() ? t('tags.editTag') : t('tags.createTag')}
          description=""
          onClose={() => setShowTagModal(false)}
        >
          <form onSubmit={handleTagSubmit} class={styles['tag-form']}>
            <FormItem
              label={t('tags.tagName')}
              id="tag-name"
              value={tagFormData().name}
              placeholder={t('tags.tagName')}
              onInput={(value) =>
                setTagFormData({ ...tagFormData(), name: String(value) })
              }
            />

            <div class={styles['color-picker']}>
              <label>{t('tags.colorPicker')}</label>
              <div class={styles['color-options']}>
                <For each={TAG_COLOR_PALETTE}>
                  {(color) => (
                    <button
                      type="button"
                      class={`${styles['color-option']} ${tagFormData().color === color ? styles.selected : ''}`}
                      style={`background-color: ${color};`}
                      onClick={() =>
                        setTagFormData({
                          ...tagFormData(),
                          color: color as string,
                        })
                      }
                    />
                  )}
                </For>
              </div>
            </div>

            <Show when={tagGroups().length > 0}>
              <div style="margin-top: 0.75em">
                <Dropdown
                  label={t('tags.tagGroup')}
                  items={[
                    { value: '', name: t('tags.groups.ungrouped') },
                    ...tagGroups().map((group) => ({
                      value: group.id.toString(),
                      name: group.name,
                    })),
                  ]}
                  value={tagFormData().tag_group_id?.toString() || ''}
                  onSelectChange={(value) => {
                    const groupId = value ? parseInt(value) : null;
                    const group = groupId
                      ? tagGroups().find((g) => g.id === groupId)
                      : null;
                    setTagFormData({
                      ...tagFormData(),
                      tag_group_id: groupId,
                      // When switching groups, adopt the group's default color
                      ...(group?.color && !editingTag()
                        ? { color: group.color }
                        : {}),
                    });
                  }}
                />
              </div>
            </Show>

            <div class={styles['form-actions']}>
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
            editingGroup()
              ? t('tags.groups.editGroup')
              : t('tags.groups.addGroup')
          }
          description=""
          onClose={() => setShowGroupModal(false)}
        >
          <form onSubmit={handleGroupSubmit} class={styles['tag-form']}>
            <FormItem
              label={t('common.name')}
              id="group-name"
              value={groupFormData().name}
              placeholder={t('tags.groups.newGroup')}
              onInput={(value) =>
                setGroupFormData({ ...groupFormData(), name: String(value) })
              }
            />

            <div class={styles['color-picker']}>
              <label>{t('tags.colorPicker')}</label>
              <div class={styles['color-options']}>
                <For each={TAG_COLOR_PALETTE}>
                  {(color) => (
                    <button
                      type="button"
                      class={`${styles['color-option']} ${groupFormData().color === color ? styles.selected : ''}`}
                      style={`background-color: ${color};`}
                      onClick={() =>
                        setGroupFormData({
                          ...groupFormData(),
                          color: color as string,
                        })
                      }
                    />
                  )}
                </For>
              </div>
            </div>

            <div class={styles['form-actions']}>
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
        title={t('tags.deleteTag')}
        message={t('tags.confirmDelete', {
          name: showConfirmDelete()?.name || '',
        })}
        onClose={() => setShowConfirmDelete(null)}
        onConfirm={() =>
          showConfirmDelete() && handleDeleteTag(showConfirmDelete()!)
        }
      />

      <ConfirmDialog
        show={!!showConfirmDeleteGroup()}
        title={t('tags.groups.deleteGroup')}
        message={t('tags.confirmDeleteGroup', {
          name: showConfirmDeleteGroup()?.name || '',
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

export default TagsPage;
