import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { pickAndUploadGroupPhoto } from '@/lib/groupAvatar';
import Avatar from '@/components/Avatar';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

export default function GroupInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);

  const [memberMenuFor, setMemberMenuFor] = useState<any>(null);
  const [busyMemberAction, setBusyMemberAction] = useState(false);

  const [addMembersVisible, setAddMembersVisible] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [addingMembers, setAddingMembers] = useState(false);

  useEffect(() => { loadInfo(); }, [id]);

  async function loadInfo() {
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id ?? null;
    setMyId(me);

    const { data: convo } = await supabase
      .from('conversations')
      .select('id, name, description, avatar_url, conversation_type')
      .eq('id', id)
      .single();
    setConversation(convo);
    setNameDraft(convo?.name ?? '');
    setDescriptionDraft(convo?.description ?? '');

    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('user_id, is_admin, joined_at')
      .eq('conversation_id', id)
      .order('joined_at', { ascending: true });

    const userIds = (participants ?? []).map((p: any) => p.user_id);
    const { data: profiles } = userIds.length > 0
      ? await supabase.from('public_profiles').select('id, username, display_name, avatar_id, avatar_url').in('id', userIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    setMembers(
      (participants ?? []).map((p: any) => ({ ...profileMap.get(p.user_id), is_admin: p.is_admin }))
    );
    setLoading(false);
  }

  const myMembership = members.find((m) => m.id === myId);
  const isAdmin = !!myMembership?.is_admin;

  async function handleChangePhoto() {
    if (!isAdmin) return;
    setUploadingPhoto(true);
    try {
      const url = await pickAndUploadGroupPhoto(id);
      if (url) {
        const { error } = await supabase.from('conversations').update({ avatar_url: url }).eq('id', id);
        if (error) throw error;
        setConversation((prev: any) => ({ ...prev, avatar_url: url }));
      }
    } catch (err: any) {
      Alert.alert('Could not update photo', err?.message ?? 'Please try again.');
    }
    setUploadingPhoto(false);
  }

  async function handleSaveName() {
    if (!nameDraft.trim()) {
      Alert.alert('Missing', 'Group name cannot be empty.');
      return;
    }
    setSavingInfo(true);
    const { error } = await supabase.from('conversations').update({ name: nameDraft.trim() }).eq('id', id);
    setSavingInfo(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setConversation((prev: any) => ({ ...prev, name: nameDraft.trim() }));
    setEditingName(false);
  }

  async function handleSaveDescription() {
    setSavingInfo(true);
    const { error } = await supabase.from('conversations').update({ description: descriptionDraft.trim() || null }).eq('id', id);
    setSavingInfo(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setConversation((prev: any) => ({ ...prev, description: descriptionDraft.trim() || null }));
    setEditingDescription(false);
  }

  function openMemberMenu(member: any) {
    if (!isAdmin || member.id === myId) return;
    setMemberMenuFor(member);
  }

  async function handleToggleAdmin() {
    if (!memberMenuFor) return;
    const member = memberMenuFor;
    setMemberMenuFor(null);
    setBusyMemberAction(true);
    const { error } = await supabase.rpc('set_group_admin', {
      p_conversation_id: id,
      p_user_id: member.id,
      p_is_admin: !member.is_admin,
    });
    setBusyMemberAction(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    loadInfo();
  }

  function confirmRemoveMember() {
    if (!memberMenuFor) return;
    const member = memberMenuFor;
    setMemberMenuFor(null);
    Alert.alert(
      'Remove Member?',
      `Remove ${member.display_name ?? 'this member'} from the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            setBusyMemberAction(true);
            const { error } = await supabase.rpc('remove_group_member', {
              p_conversation_id: id,
              p_user_id: member.id,
            });
            setBusyMemberAction(false);
            if (error) {
              Alert.alert('Error', error.message);
              return;
            }
            loadInfo();
          },
        },
      ]
    );
  }

  function confirmLeaveGroup() {
    Alert.alert('Leave Group?', "You'll no longer see messages in this group.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave Group', style: 'destructive', onPress: async () => {
          if (!myId) return;
          const { error } = await supabase
            .from('conversation_participants')
            .delete()
            .eq('conversation_id', id)
            .eq('user_id', myId);
          if (error) {
            Alert.alert('Error', error.message);
            return;
          }
          router.replace('/chat');
        },
      },
    ]);
  }

  async function openAddMembers() {
    setAddMembersVisible(true);
    setCandidatesLoading(true);
    setSelectedCandidates(new Set());

    const { data: asFollower } = await supabase.from('follows').select('following_id').eq('follower_id', myId);
    const { data: asFollowing } = await supabase.from('follows').select('follower_id').eq('following_id', myId);
    const memberIds = new Set(members.map((m) => m.id));
    const otherIds = [...new Set([
      ...(asFollower ?? []).map((r: any) => r.following_id),
      ...(asFollowing ?? []).map((r: any) => r.follower_id),
    ])].filter((uid) => !memberIds.has(uid));

    if (otherIds.length === 0) {
      setCandidates([]);
      setCandidatesLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from('public_profiles')
      .select('id, display_name, avatar_id, avatar_url')
      .in('id', otherIds);
    setCandidates(profiles ?? []);
    setCandidatesLoading(false);
  }

  function toggleCandidate(userId: string) {
    setSelectedCandidates((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleAddMembers() {
    if (selectedCandidates.size === 0) return;
    setAddingMembers(true);
    const { error } = await supabase.rpc('add_group_members', {
      p_conversation_id: id,
      p_member_ids: Array.from(selectedCandidates),
    });
    setAddingMembers(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setAddMembersVisible(false);
    loadInfo();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Info</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.photoSection}>
          <TouchableOpacity onPress={handleChangePhoto} disabled={!isAdmin || uploadingPhoto} activeOpacity={isAdmin ? 0.8 : 1}>
            {conversation?.avatar_url ? (
              <Avatar avatarUrl={conversation.avatar_url} username={conversation.name} size={96} />
            ) : (
              <View style={styles.groupIconLarge}>
                <Ionicons name="people" size={40} color="#fff" />
              </View>
            )}
            {isAdmin && (
              <View style={styles.photoEditBadge}>
                {uploadingPhoto
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="camera" size={16} color="#fff" />
                }
              </View>
            )}
          </TouchableOpacity>

          {editingName ? (
            <View style={styles.editNameRow}>
              <TextInput
                style={styles.editNameInput}
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="Group name"
                placeholderTextColor={colors.textDisabled}
                autoFocus
              />
              <TouchableOpacity onPress={handleSaveName} disabled={savingInfo} style={styles.editSaveBtn}>
                {savingInfo ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.nameRow}
              onPress={() => isAdmin && setEditingName(true)}
              disabled={!isAdmin}
            >
              <Text style={styles.groupName}>{conversation?.name ?? 'Group'}</Text>
              {isAdmin && <Ionicons name="pencil" size={14} color={colors.textFaint} />}
            </TouchableOpacity>
          )}

          {editingDescription ? (
            <View style={styles.editNameRow}>
              <TextInput
                style={[styles.editNameInput, styles.descriptionInput]}
                value={descriptionDraft}
                onChangeText={setDescriptionDraft}
                placeholder="Add a group description"
                placeholderTextColor={colors.textDisabled}
                multiline
                autoFocus
              />
              <TouchableOpacity onPress={handleSaveDescription} disabled={savingInfo} style={styles.editSaveBtn}>
                {savingInfo ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => isAdmin && setEditingDescription(true)} disabled={!isAdmin}>
              <Text style={styles.groupDescription}>
                {conversation?.description || (isAdmin ? 'Add a group description' : '')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.membersSectionHeader}>
          <Text style={styles.membersSectionTitle}>{members.length} members</Text>
          {isAdmin && (
            <TouchableOpacity style={styles.addMemberBtn} onPress={openAddMembers}>
              <Ionicons name="person-add" size={14} color={colors.accent} />
              <Text style={styles.addMemberBtnText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {members.map((member) => (
          <TouchableOpacity
            key={member.id}
            style={styles.memberRow}
            onPress={() => member.id !== myId && router.push(`/user-profile?id=${member.id}`)}
            onLongPress={() => openMemberMenu(member)}
          >
            <Avatar avatarId={member.avatar_id} avatarUrl={member.avatar_url} username={member.display_name} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>
                {member.display_name ?? 'Unknown'}{member.id === myId ? ' (You)' : ''}
              </Text>
              {member.username && <Text style={styles.memberUsername}>@{member.username}</Text>}
            </View>
            {member.is_admin && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
            )}
            {isAdmin && member.id !== myId && (
              <TouchableOpacity onPress={() => openMemberMenu(member)} style={styles.memberMenuBtn}>
                <Ionicons name="ellipsis-vertical" size={16} color={colors.textFaint} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.leaveBtn} onPress={confirmLeaveGroup}>
          <Ionicons name="exit-outline" size={18} color={colors.error} />
          <Text style={styles.leaveBtnText}>Leave Group</Text>
        </TouchableOpacity>
      </ScrollView>

      {busyMemberAction && (
        <View style={styles.busyOverlay}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      )}

      <Modal visible={!!memberMenuFor} transparent animationType="fade" onRequestClose={() => setMemberMenuFor(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMemberMenuFor(null)}>
          <View style={styles.actionSheet}>
            <Text style={styles.actionSheetTitle}>{memberMenuFor?.display_name}</Text>
            <TouchableOpacity style={styles.actionRow} onPress={handleToggleAdmin}>
              <Ionicons name={memberMenuFor?.is_admin ? 'shield-outline' : 'shield-checkmark-outline'} size={18} color={colors.textPrimary} />
              <Text style={styles.actionRowText}>
                {memberMenuFor?.is_admin ? 'Remove as Admin' : 'Make Admin'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionRow} onPress={confirmRemoveMember}>
              <Ionicons name="person-remove-outline" size={18} color={colors.error} />
              <Text style={[styles.actionRowText, { color: colors.error }]}>Remove from Group</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={addMembersVisible} transparent animationType="slide" onRequestClose={() => setAddMembersVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setAddMembersVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.addSheet}>
            <Text style={styles.actionSheetTitle}>Add Members</Text>
            {candidatesLoading ? (
              <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={candidates}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 320 }}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No one else to add — everyone you follow (or who follows you) is already in this group.</Text>
                }
                renderItem={({ item }) => {
                  const isSelected = selectedCandidates.has(item.id);
                  return (
                    <TouchableOpacity style={styles.candidateRow} onPress={() => toggleCandidate(item.id)}>
                      <Avatar avatarId={item.avatar_id} avatarUrl={item.avatar_url} username={item.display_name} size={38} />
                      <Text style={styles.memberName}>{item.display_name ?? 'Unknown'}</Text>
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={isSelected ? colors.accent : colors.textFaint}
                      />
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            <TouchableOpacity
              style={[styles.addMembersConfirmBtn, selectedCandidates.size === 0 && { opacity: 0.5 }]}
              onPress={handleAddMembers}
              disabled={selectedCandidates.size === 0 || addingMembers}
            >
              {addingMembers
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.addMembersConfirmText}>Add ({selectedCandidates.size})</Text>
              }
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: colors.borderMuted,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
    content: { padding: 20, paddingBottom: 48 },
    photoSection: { alignItems: 'center', marginBottom: 24 },
    groupIconLarge: {
      width: 96, height: 96, borderRadius: 48, backgroundColor: colors.accent,
      justifyContent: 'center', alignItems: 'center',
    },
    photoEditBadge: {
      position: 'absolute', bottom: 0, right: 0,
      width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 2, borderColor: colors.background,
    },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
    groupName: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
    groupDescription: { color: colors.textFaint, fontSize: 13, marginTop: 6, textAlign: 'center' },
    editNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, width: '100%' },
    editNameInput: {
      flex: 1, backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 10, fontSize: 15,
      borderWidth: 1, borderColor: colors.border,
    },
    descriptionInput: { minHeight: 60, textAlignVertical: 'top' },
    editSaveBtn: {
      width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent,
      justifyContent: 'center', alignItems: 'center',
    },
    membersSectionHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 10,
    },
    membersSectionTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
    addMemberBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    addMemberBtnText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
    memberRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.surface, borderRadius: 14, padding: 12,
      marginBottom: 8, borderWidth: 1, borderColor: colors.borderMuted,
    },
    memberName: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
    memberUsername: { color: colors.textFaint, fontSize: 12, marginTop: 1 },
    adminBadge: {
      backgroundColor: colors.accentMuted, borderRadius: 10,
      paddingHorizontal: 8, paddingVertical: 3,
    },
    adminBadgeText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
    memberMenuBtn: { padding: 4 },
    leaveBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      marginTop: 20, paddingVertical: 14, borderRadius: 12,
      borderWidth: 1, borderColor: colors.error,
    },
    leaveBtnText: { color: colors.error, fontSize: 15, fontWeight: '700' },
    busyOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center',
    },
    modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    actionSheet: {
      backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingHorizontal: 20, paddingTop: 20, paddingBottom: 34,
      borderWidth: 1, borderColor: colors.border, borderBottomWidth: 0,
    },
    actionSheetTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 12 },
    actionRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border,
    },
    actionRowText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
    addSheet: {
      backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingHorizontal: 20, paddingTop: 20, paddingBottom: 34,
      borderWidth: 1, borderColor: colors.border, borderBottomWidth: 0,
    },
    candidateRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border,
    },
    emptyText: { color: colors.textFaint, textAlign: 'center', marginTop: 20, marginBottom: 10 },
    addMembersConfirmBtn: {
      backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14,
      alignItems: 'center', marginTop: 16,
    },
    addMembersConfirmText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  });
}
