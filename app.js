// ChatFlow - Real-time Messaging App
// Complete JavaScript Implementation

// ============================================
// CONFIGURATION
// ============================================
const SUPABASE_URL = 'https://qyantbqmxavlobsiexpn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5YW50YnFteGF2bG9ic2lleHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMDc4MjMsImV4cCI6MjA5MjU4MzgyM30.8VBtpmuqDcn6o5fugWYnu3Qzdhfytb9vBoS7yV0oJ5E';

let supabase = null;

// ============================================
// INITIALIZATION
// ============================================
function initSupabase() {
  if (typeof window.supabase === 'undefined') {
    console.error('Supabase client not loaded');
    return false;
  }
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return true;
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!initSupabase()) {
    showToast('Failed to load app. Please refresh.', 'error');
    return;
  }
  await checkSession();
});

// Handle auth state changes
if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      showAuthScreen();
    }
  });
}

// Close modals on outside click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal') && !e.target.closest('.modal-content')) {
    e.target.classList.add('hidden');
  }
});

// ============================================
// STATE MANAGEMENT
// ============================================
let currentUser = null;
let currentChat = null;
let selectedMessage = null;
let realtimeChannel = null;
let callsChannel = null;

// Voice recording state
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingTimer = null;
let recordingSeconds = 0;

// WebRTC state
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let currentCall = null;
let isCallActive = false;
let isMuted = false;
let isCameraOff = false;

// File upload state
let selectedFile = null;

// ICE servers configuration
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// ============================================
// AUTHENTICATION
// ============================================

// Check session on load
async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    await loadUserProfile();
    showMainScreen();
    initializeRealtime();
    loadChats();
  }
}

// Handle login
async function handleLogin(event) {
  event.preventDefault();
  showLoading();

  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    hideLoading();
    showToast(error.message, 'error');
    return;
  }

  currentUser = data.user;
  await loadUserProfile();
  hideLoading();
  showMainScreen();
  initializeRealtime();
  loadChats();
}

// Handle register
async function handleRegister(event) {
  event.preventDefault();
  showLoading();

  const name = document.getElementById('register-name').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name }
    }
  });

  if (error) {
    hideLoading();
    showToast(error.message, 'error');
    return;
  }

  // Update profile name
  if (data.user) {
    await supabase
      .from('profiles')
      .update({ name })
      .eq('id', data.user.id);
  }

  hideLoading();
  showToast('Account created! Please check your email to verify.', 'success');
  
  // Auto login after signup (if email confirmation not required)
  if (data.session) {
    currentUser = data.user;
    await loadUserProfile();
    showMainScreen();
    initializeRealtime();
    loadChats();
  }
}

// Handle logout
async function handleLogout() {
  await supabase.auth.signOut();
  currentUser = null;
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
  }
  if (callsChannel) {
    supabase.removeChannel(callsChannel);
  }
  showAuthScreen();
  showToast('Logged out successfully', 'success');
}

// Show auth form
function showAuthForm(form) {
  document.getElementById('login-form').classList.toggle('hidden', form !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', form !== 'register');
}

// ============================================
// PROFILE MANAGEMENT
// ============================================

// Load user profile
async function loadUserProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();

  if (data) {
    document.getElementById('current-user-name').textContent = data.name || 'User';
    document.getElementById('settings-name').value = data.name || '';
  }
}

// Update profile name
async function updateProfileName(name) {
  const { error } = await supabase
    .from('profiles')
    .update({ name })
    .eq('id', currentUser.id);

  if (error) {
    showToast('Failed to update name', 'error');
    return;
  }

  document.getElementById('current-user-name').textContent = name;
  showToast('Name updated', 'success');
}

// ============================================
// UI SCREENS
// ============================================

function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('main-screen').classList.add('hidden');
}

function showMainScreen() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('main-screen').classList.remove('hidden');
}

function showLoading() {
  document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.add('hidden');
}

function showUserSettings() {
  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function showDeleteAccount() {
  document.getElementById('delete-account-modal').classList.remove('hidden');
}

function closeDeleteAccount() {
  document.getElementById('delete-account-modal').classList.add('hidden');
}

function showUserSearch() {
  document.getElementById('user-search-modal').classList.remove('hidden');
  document.getElementById('user-search-input').value = '';
  document.getElementById('user-results').innerHTML = '';
}

function closeUserSearch() {
  document.getElementById('user-search-modal').classList.add('hidden');
}

function closeUserProfile() {
  document.getElementById('user-profile-modal').classList.add('hidden');
}

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

function initializeRealtime() {
  // Messages realtime
  realtimeChannel = supabase
    .channel('messages')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${currentUser.id}`
      },
      handleMessageUpdate
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      },
      handleNewMessage
    )
    .subscribe();

  // Calls realtime
  callsChannel = supabase
    .channel('calls')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'calls',
        filter: `receiver_id=eq.${currentUser.id}`
      },
      handleCallUpdate
    )
    .subscribe();
}

function handleMessageUpdate(payload) {
  if (currentChat && payload.new) {
    const otherUserId = currentChat.id;
    if (payload.new.sender_id === otherUserId || payload.new.receiver_id === otherUserId) {
      loadMessages(otherUserId);
    }
  }
  loadChats();
}

function handleNewMessage(payload) {
  loadChats();
}

function handleCallUpdate(payload) {
  if (payload.new) {
    const call = payload.new;
    
    if (call.status === 'accepted' && currentCall && currentCall.id === call.id) {
      // Accept call - set up WebRTC
      if (call.answer) {
        handleAnswerReceived(call.answer);
      }
    } else if (call.status === 'rejected') {
      showToast('Call rejected', 'info');
      closeCallModal();
    } else if (call.status === 'ended') {
      endCall();
    }
  }
}

// ============================================
// CHAT LIST
// ============================================

async function loadChats() {
  if (!currentUser) return;

  showLoading();

  // Get all messages involving current user
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
    .order('created_at', { ascending: false });

  if (error) {
    hideLoading();
    showToast('Failed to load chats', 'error');
    return;
  }

  // Group by other user
  const chats = {};
  messages.forEach(msg => {
    const otherUserId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
    if (!chats[otherUserId] || new Date(msg.created_at) > new Date(chats[otherUserId].created_at)) {
      if (!msg.deleted || msg.sender_id === currentUser.id) {
        chats[otherUserId] = msg;
      }
    }
  });

  // Get user profiles
  const userIds = Object.keys(chats);
  const chatList = document.getElementById('chat-list');
  chatList.innerHTML = '';

  for (const userId of userIds) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profile) {
      const msg = chats[userId];
      const isSent = msg.sender_id === currentUser.id;
      const preview = msg.deleted ? 'This message was deleted' : (msg.content || 'Sent a file');
      
      const chatItem = document.createElement('div');
      chatItem.className = 'chat-item';
      chatItem.onclick = () => openChat(userId, profile.name);
      chatItem.innerHTML = `
        <div class="avatar small">
          <i class="fas fa-user"></i>
        </div>
        <div class="chat-item-info">
          <div class="chat-item-header">
            <span class="chat-item-name">${profile.name}</span>
            <span class="chat-item-time">${formatTime(msg.created_at)}</span>
          </div>
          <span class="chat-item-preview">${isSent ? 'You: ' : ''}${preview}</span>
        </div>
      `;
      chatList.appendChild(chatItem);
    }
  }

  hideLoading();
}

function filterChats(query) {
  const items = document.querySelectorAll('.chat-item');
  query = query.toLowerCase();
  
  items.forEach(item => {
    const name = item.querySelector('.chat-item-name').textContent.toLowerCase();
    const preview = item.querySelector('.chat-item-preview').textContent.toLowerCase();
    item.classList.toggle('hidden', !name.includes(query) && !preview.includes(query));
  });
}

// ============================================
// MESSAGING
// ============================================

async function openChat(userId, userName) {
  currentChat = { id: userId, name: userName };
  
  document.getElementById('chat-user-name').textContent = userName;
  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('active-chat').classList.remove('hidden');
  
  // Show/hide back button on mobile
  if (window.innerWidth <= 768) {
    document.getElementById('chat-window').classList.add('active');
  }
  
  await loadMessages(userId);
  markMessagesSeen(userId);
}

function closeChat() {
  currentChat = null;
  document.getElementById('active-chat').classList.add('hidden');
  document.getElementById('empty-state').classList.remove('hidden');
  document.getElementById('chat-window').classList.remove('active');
}

async function loadMessages(userId) {
  if (!currentUser) return;

  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`)
    .order('created_at', { ascending: true });

  if (error) {
    showToast('Failed to load messages', 'error');
    return;
  }

  const messagesList = document.getElementById('messages-list');
  messagesList.innerHTML = '';

  messages.forEach(msg => {
    const isSent = msg.sender_id === currentUser.id;
    const showContent = !msg.deleted || isSent;
    
    if (!msg.deleted || isSent || !msg.deleted_for_everyone) {
      const messageEl = createMessageElement(msg, isSent, showContent);
      messagesList.appendChild(messageEl);
    }
  });

  scrollToBottom();
}

function createMessageElement(msg, isSent, showContent) {
  const div = document.createElement('div');
  div.className = `message ${isSent ? 'sent' : 'received'}`;
  div.dataset.id = msg.id;
  div.onclick = (e) => showMessageActions(msg, e);

  let content = '';
  
  if (!showContent) {
    content = '<span class="deleted">This message was deleted</span>';
    div.classList.add('deleted');
  } else {
    switch (msg.type) {
      case 'text':
        content = `<div class="message-content">${escapeHtml(msg.content)}</div>`;
        break;
      case 'image':
        content = `<div class="message-image"><img src="${msg.file_url}" alt="Image" onclick="previewFile(event, '${msg.file_url}')"></div>`;
        break;
      case 'video':
        content = `<div class="message-video"><video src="${msg.file_url}" controls></video></div>`;
        break;
      case 'audio':
        content = `
          <div class="message-audio">
            <button class="audio-play-btn" onclick="playAudio(event, '${msg.file_url}')">
              <i class="fas fa-play"></i>
            </button>
            <div class="audio-waveform"></div>
            <span class="audio-duration">${msg.file_name || '0:00'}</span>
          </div>
        `;
        break;
      case 'file':
        content = `
          <div class="file-message">
            <div class="file-icon">
              <i class="fas fa-file"></i>
            </div>
            <div class="file-info">
              <div class="file-name">${msg.file_name || 'File'}</div>
              <div class="file-size">${formatFileSize(msg.file_size)}</div>
            </div>
            <button class="btn-icon" onclick="downloadFile(event, '${msg.file_url}', '${msg.file_name}')">
              <i class="fas fa-download"></i>
            </button>
          </div>
        `;
        break;
    }
  }

  let meta = `<span class="message-meta">${formatTime(msg.created_at)}</span>`;
  
  if (isSent && msg.seen) {
    meta += `<span class="message-status"><i class="fas fa-check-double"></i></span>`;
  }
  
  if (msg.updated_at && msg.updated_at !== msg.created_at) {
    div.classList.add('edited');
    meta += `<span class="message-edited">edited</span>`;
  }

  div.innerHTML = content + meta;
  return div;
}

async function sendMessage() {
  if (!currentChat || !currentUser) return;

  const input = document.getElementById('message-input');
  const content = input.value.trim();
  
  if (!content && !selectedFile) return;

  showLoading();

  const message = {
    sender_id: currentUser.id,
    receiver_id: currentChat.id,
    content: content,
    type: selectedFile ? 'file' : 'text',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (selectedFile) {
    // Upload file first
    const { data, error } = await uploadFile(selectedFile);
    
    if (error) {
      hideLoading();
      showToast('Failed to upload file', 'error');
      return;
    }

    message.file_url = data.path;
    message.file_name = selectedFile.name;
    message.file_size = selectedFile.size;
    message.mime_type = selectedFile.type;
    
    if (selectedFile.type.startsWith('image/')) {
      message.type = 'image';
    } else if (selectedFile.type.startsWith('video/')) {
      message.type = 'video';
    }
  }

  const { data, error } = await supabase
    .from('messages')
    .insert(message)
    .select()
    .single();

  hideLoading();

  if (error) {
    showToast('Failed to send message', 'error');
    return;
  }

  // Clear input and file
  input.value = '';
  selectedFile = null;
  
  // Reload messages
  await loadMessages(currentChat.id);
  await loadChats();
}

function handleMessageKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

// Mark messages as seen
async function markMessagesSeen(userId) {
  await supabase
    .from('messages')
    .update({ seen: true })
    .eq('receiver_id', currentUser.id)
    .eq('sender_id', userId)
    .eq('seen', false);
}

// ============================================
// MESSAGE ACTIONS
// ============================================

function showMessageActions(msg, event) {
  event.stopPropagation();
  selectedMessage = msg;
  document.getElementById('message-actions-modal').classList.remove('hidden');
}

function closeMessageActions() {
  document.getElementById('message-actions-modal').classList.add('hidden');
  selectedMessage = null;
}

async function editMessage() {
  if (!selectedMessage || selectedMessage.sender_id !== currentUser.id) return;
  
  const content = prompt('Edit message:', selectedMessage.content);
  if (!content) return;

  const { error } = await supabase
    .from('messages')
    .update({
      content,
      updated_at: new Date().toISOString()
    })
    .eq('id', selectedMessage.id);

  closeMessageActions();

  if (error) {
    showToast('Failed to edit message', 'error');
    return;
  }

  showToast('Message edited', 'success');
  if (currentChat) {
    await loadMessages(currentChat.id);
  }
}

async function deleteMessageForMe() {
  if (!selectedMessage) return;

  const { error } = await supabase
    .from('messages')
    .update({ deleted: true })
    .eq('id', selectedMessage.id);

  closeMessageActions();

  if (error) {
    showToast('Failed to delete message', 'error');
    return;
  }

  showToast('Message deleted', 'success');
  if (currentChat) {
    await loadMessages(currentChat.id);
  }
  await loadChats();
}

async function deleteMessageForEveryone() {
  if (!selectedMessage || selectedMessage.sender_id !== currentUser.id) return;

  const { error } = await supabase
    .from('messages')
    .update({
      deleted: true,
      deleted_for_everyone: true
    })
    .eq('id', selectedMessage.id);

  closeMessageActions();

  if (error) {
    showToast('Failed to delete message', 'error');
    return;
  }

  showToast('Message deleted for everyone', 'success');
  if (currentChat) {
    await loadMessages(currentChat.id);
  }
  await loadChats();
}

function forwardMessage() {
  if (!selectedMessage) return;
  
  document.getElementById('message-actions-modal').classList.add('hidden');
  document.getElementById('forward-modal').classList.remove('hidden');
  
  // Show preview
  const preview = document.createElement('div');
  preview.className = 'forward-preview';
  preview.innerHTML = `<p>${selectedMessage.content || 'File'}</p>`;
  
  const results = document.getElementById('forward-results');
  results.innerHTML = '';
  results.appendChild(preview);
}

function closeForward() {
  document.getElementById('forward-modal').classList.add('hidden');
  selectedMessage = null;
}

async function searchForwardUsers(query) {
  if (!query) {
    document.getElementById('forward-results').innerHTML = '';
    return;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
    .neq('id', currentUser.id)
    .limit(10);

  if (error) return;

  const results = document.getElementById('forward-results');
  results.innerHTML = '';

  data.forEach(user => {
    const item = document.createElement('div');
    item.className = 'user-result-item';
    item.onclick = () => forwardToUser(user);
    item.innerHTML = `
      <div class="avatar small">
        <i class="fas fa-user"></i>
      </div>
      <div class="user-result-info">
        <div class="user-result-name">${user.name}</div>
        <div class="user-result-email">${user.email}</div>
      </div>
    `;
    results.appendChild(item);
  });
}

async function forwardToUser(user) {
  const message = {
    sender_id: currentUser.id,
    receiver_id: user.id,
    content: selectedMessage.content,
    type: selectedMessage.type,
    file_url: selectedMessage.file_url,
    file_name: selectedMessage.file_name,
    file_size: selectedMessage.file_size,
    mime_type: selectedMessage.mime_type,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('messages')
    .insert(message);

  closeForward();

  if (error) {
    showToast('Failed to forward message', 'error');
    return;
  }

  showToast('Message forwarded', 'success');
}

// ============================================
// FILE HANDLING
// ============================================

function triggerFileUpload() {
  document.getElementById('file-input').click();
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    selectedFile = file;
    showToast(`Selected: ${file.name}`, 'info');
  }
}

async function uploadFile(file) {
  const fileName = `${Date.now()}-${file.name}`;
  
  return await supabase.storage
    .from('chat-files')
    .upload(fileName, file);
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function previewFile(event, url) {
  event.stopPropagation();
  const modal = document.createElement('div');
  modal.className = 'file-preview';
  modal.onclick = () => modal.remove();
  modal.innerHTML = `
    <img src="${url}" alt="Preview">
    <button class="btn-icon file-preview-close">
      <i class="fas fa-times"></i>
    </button>
  `;
  document.body.appendChild(modal);
}

function downloadFile(event, url, name) {
  event.stopPropagation();
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
}

// ============================================
// VOICE RECORDING
// ============================================

async function toggleVoiceRecording() {
  if (isRecording) {
    stopVoiceRecording();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      await uploadVoiceMessage(audioBlob);
      stream.getTracks().forEach(track => track.stop());
    };

    mediaRecorder.start();
    isRecording = true;
    recordingSeconds = 0;
    
    document.getElementById('voice-recording').classList.remove('hidden');
    document.getElementById('voice-record-btn').classList.add('recording');
    
    recordingTimer = setInterval(() => {
      recordingSeconds++;
      const mins = Math.floor(recordingSeconds / 60);
      const secs = recordingSeconds % 60;
      document.getElementById('recording-time').textContent = 
        `${mins}:${secs.toString().padStart(2, '0')}`;
    }, 1000);

  } catch (err) {
    showToast('Microphone access denied', 'error');
  }
}

function stopVoiceRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    clearInterval(recordingTimer);
    
    document.getElementById('voice-recording').classList.add('hidden');
    document.getElementById('voice-record-btn').classList.remove('recording');
  }
}

async function uploadVoiceMessage(audioBlob) {
  showLoading();

  const fileName = `${Date.now()}-voice.webm`;
  
  const { data, error } = await supabase.storage
    .from('voice-messages')
    .upload(fileName, audioBlob);

  if (error) {
    hideLoading();
    showToast('Failed to upload voice message', 'error');
    return;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('voice-messages')
    .getPublicUrl(fileName);

  const message = {
    sender_id: currentUser.id,
    receiver_id: currentChat.id,
    content: null,
    type: 'audio',
    file_url: urlData.publicUrl,
    file_name: formatTime(new Date().toISOString()),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { error: insertError } = await supabase
    .from('messages')
    .insert(message);

  hideLoading();

  if (insertError) {
    showToast('Failed to send voice message', 'error');
    return;
  }

  if (currentChat) {
    await loadMessages(currentChat.id);
  }
  await loadChats();
  showToast('Voice message sent', 'success');
}

function playAudio(event, url) {
  event.stopPropagation();
  const audio = new Audio(url);
  audio.play();
}

// ============================================
// USER SEARCH
// ============================================

async function searchUsers(query) {
  if (!query) {
    document.getElementById('user-results').innerHTML = '';
    return;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
    .neq('id', currentUser.id)
    .limit(10);

  if (error) return;

  const results = document.getElementById('user-results');
  results.innerHTML = '';

  data.forEach(user => {
    const item = document.createElement('div');
    item.className = 'user-result-item';
    item.onclick = () => startChatWithUser(user);
    item.innerHTML = `
      <div class="avatar small">
        <i class="fas fa-user"></i>
      </div>
      <div class="user-result-info">
        <div class="user-result-name">${user.name}</div>
        <div class="user-result-email">${user.email}</div>
      </div>
    `;
    results.appendChild(item);
  });
}

function startChatWithUser(user) {
  closeUserSearch();
  openChat(user.id, user.name);
}

function showUserProfile() {
  if (!currentChat) return;
  
  document.getElementById('profile-name').textContent = currentChat.name;
  document.getElementById('profile-email').textContent = ''; // Don't show email for privacy
  document.getElementById('user-profile-modal').classList.remove('hidden');
}

function startChatFromProfile() {
  if (currentChat) {
    openChat(currentChat.id, currentChat.name);
  }
  closeUserProfile();
}

// ============================================
// VOICE CALL (WebRTC)
// ============================================

async function startVoiceCall() {
  if (!currentChat) return;

  showLoading();
  
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    hideLoading();
    showToast('Microphone access denied', 'error');
    return;
  }

  hideLoading();

  // Create call record
  const { data, error } = await supabase
    .from('calls')
    .insert({
      caller_id: currentUser.id,
      receiver_id: currentChat.id,
      type: 'voice',
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    showToast('Failed to start call', 'error');
    return;
  }

  currentCall = data;
  showCallModal('voice');
  
  // Wait for answer
  showToast('Calling...', 'info');
}

async function startVideoCall() {
  if (!currentChat) return;

  showLoading();
  
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch (err) {
    hideLoading();
    showToast('Camera/microphone access denied', 'error');
    return;
  }

  hideLoading();

  // Create call record
  const { data, error } = await supabase
    .from('calls')
    .insert({
      caller_id: currentUser.id,
      receiver_id: currentChat.id,
      type: 'video',
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    showToast('Failed to start call', 'error');
    return;
  }

  currentCall = data;
  showCallModal('video');
  
  showToast('Calling...', 'info');
}

function showCallModal(type) {
  const modal = document.getElementById('call-modal');
  const callType = type === 'video' ? 'Video' : 'Voice';
  
  document.getElementById('call-title').textContent = `${callType} Call`;
  document.getElementById('call-status').textContent = 'Calling...';
  
  // Show local video
  const localVideo = document.getElementById('local-video');
  localVideo.srcObject = localStream;
  localVideo.classList.toggle('hidden', type !== 'video');
  
  document.getElementById('accept-call-btn').classList.add('hidden');
  document.getElementById('reject-call-btn').classList.add('hidden');
  document.querySelector('.call-actions').classList.add('hidden');
  document.querySelector('.call-controls').classList.add('hidden');
  
  modal.classList.remove('hidden');
  isCallActive = true;
}

async function acceptCall() {
  if (!currentCall) return;

  showLoading();
  
  try {
    const constraints = currentCall.type === 'video' 
      ? { video: true, audio: true }
      : { audio: true };
    
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    hideLoading();
    showToast('Failed to access media', 'error');
    return;
  }

  // Create peer connection
  peerConnection = new RTCPeerConnection(iceServers);
  
  // Add local tracks
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });
  
  // Handle remote stream
  peerConnection.ontrack = (event) => {
    remoteStream = event.streams[0];
    document.getElementById('remote-video').srcObject = remoteStream;
  };
  
  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendIceCandidate(event.candidate);
    }
  };

  // Create offer
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  // Update call record
  await supabase
    .from('calls')
    .update({
      status: 'accepted',
      answer: offer
    })
    .eq('id', currentCall.id);

  hideLoading();
  
  document.getElementById('call-status').textContent = 'Connected';
  document.getElementById('accept-call-btn').classList.add('hidden');
  document.getElementById('reject-call-btn').classList.add('hidden');
  document.querySelector('.call-actions').classList.remove('hidden');
  document.querySelector('.call-controls').classList.remove('hidden');
}

async function rejectCall() {
  if (!currentCall) return;

  await supabase
    .from('calls')
    .update({ status: 'rejected' })
    .eq('id', currentCall.id);

  closeCallModal();
}

async function endCall() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
    remoteStream = null;
  }
  
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (currentCall) {
    await supabase
      .from('calls')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString()
      })
      .eq('id', currentCall.id);
    
    currentCall = null;
  }

  closeCallModal();
  showToast('Call ended', 'info');
}

function closeCallModal() {
  document.getElementById('call-modal').classList.add('hidden');
  isCallActive = false;
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  if (document.getElementById('local-video').srcObject) {
    document.getElementById('local-video').srcObject = null;
  }
  
  if (document.getElementById('remote-video').srcObject) {
    document.getElementById('remote-video').srcObject = null;
  }
}

function toggleMute() {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      isMuted = !audioTrack.enabled;
      
      const btn = document.getElementById('mute-btn');
      btn.innerHTML = isMuted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
      btn.style.background = isMuted ? 'var(--accent-red)' : '';
    }
  }
}

function toggleCamera() {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      isCameraOff = !videoTrack.enabled;
      
      const btn = document.getElementById('camera-btn');
      btn.innerHTML = isCameraOff ? '<i class="fas fa-video-slash"></i>' : '<i class="fas fa-video"></i>';
      btn.style.background = isCameraOff ? 'var(--accent-red)' : '';
    }
  }
}

// WebRTC signaling
async function sendIceCandidate(candidate) {
  if (!currentCall) return;
  
  await supabase
    .from('calls')
    .update({ answer: { iceCandidate: candidate } })
    .eq('id', currentCall.id);
}

async function handleAnswerReceived(answer) {
  if (!peerConnection) return;
  
  if (answer.iceCandidate) {
    await peerConnection.addIceCandidate(answer.iceCandidate);
  }
}

// ============================================
// ACCOUNT DELETION
// ============================================

async function deleteAccount() {
  const confirm = document.getElementById('delete-confirm').value;
  
  if (confirm !== 'DELETE') {
    showToast('Type DELETE to confirm', 'error');
    return;
  }

  showLoading();

  // Delete all messages
  await supabase
    .from('messages')
    .delete()
    .eq('sender_id', currentUser.id);

  // Delete profile
  await supabase
    .from('profiles')
    .delete()
    .eq('id', currentUser.id);

  // Delete auth user
  const { error } = await supabase.auth.deleteUser();

  hideLoading();
  closeDeleteAccount();
  closeSettings();

  if (error) {
    showToast(error.message, 'error');
    return;
  }

  showToast('Account deleted', 'success');
  handleLogout();
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function scrollToBottom() {
  const container = document.getElementById('messages-container');
  container.scrollTop = container.scrollHeight;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}