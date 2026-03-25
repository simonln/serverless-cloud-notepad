
const DEFAULT_LANG = 'en'
const SUPPORTED_LANG = {
    'en': {
        err: 'Error',
        pepw: 'Please enter password.',
        pwcnbe: 'Password is empty!',
        enpw: 'Enter a new password(Keeping it empty will remove the current password)',
        pwss: 'Password set successfully.',
        pwrs: 'Password removed successfully.',
        cpys: 'Copied!',
        save: 'Save',
        saving: 'Saving...',
        saved: 'Saved',
        unsaved: 'Unsaved changes',
        saveFailed: 'Save failed',
        notesLoading: 'Loading notes...',
        notesLoadFailed: 'Failed to load notes list',
        notesEmpty: 'No notes yet.',
        noteEncrypted: 'Encrypted',
        noteShared: 'Shared',
        noteOpen: 'Open',
        leaveDiscardConfirm: 'This note has unsaved changes. Please save manually if needed. Click OK to discard changes and continue, or Cancel to stay on this page.',
        beforeUnloadPrompt: 'You have unsaved changes.',
    },
    'zh': {
        err: '出错了',
        pepw: '请输入密码',
        pwcnbe: '密码不能为空！',
        enpw: '输入新密码（留空可清除当前密码）',
        pwss: '密码设置成功！',
        pwrs: '密码清除成功！',
        cpys: '已复制',
        save: '保存',
        saving: '保存中...',
        saved: '已保存',
        unsaved: '有未保存更改',
        saveFailed: '保存失败',
        notesLoading: '正在加载笔记...',
        notesLoadFailed: '加载笔记列表失败',
        notesEmpty: '还没有任何笔记',
        noteEncrypted: '已加密',
        noteShared: '已分享',
        noteOpen: '打开',
        leaveDiscardConfirm: '当前笔记有未保存内容，如需保留请先手动保存。点击“确定”放弃更改并继续，点击“取消”则留在当前页面。',
        beforeUnloadPrompt: '当前有未保存内容。',
    }
}

const getI18n = key => {
    const userLang = (navigator.language || navigator.userLanguage || DEFAULT_LANG).split('-')[0]
    const targetLang = Object.keys(SUPPORTED_LANG).find(l => l === userLang) || DEFAULT_LANG
    return SUPPORTED_LANG[targetLang][key]
}

const errHandle = (err) => {
    alert(`${getI18n('err')}: ${err}`)
}

const passwdPrompt = () => {
    const passwd = window.prompt(getI18n('pepw'))
    if (passwd == null) return;

    if (!passwd.trim()) {
        alert(getI18n('pwcnbe'))
    }
    const path = location.pathname
    window.fetch(`${path}/auth`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            passwd,
        }),
    })
        .then(res => res.json())
        .then(res => {
            if (res.err !== 0) {
                return errHandle(res.msg)
            }
            if (res.data.refresh) {
                window.location.reload()
            }
        })
        .catch(err => errHandle(err))
}

const renderPlain = (node, text) => {
    if (node) {
        node.innerHTML = window.DOMPurify ? DOMPurify.sanitize(text) : text
    }
}

const configureMarked = () => {
    if (!window.marked || configureMarked.initialized) return

    marked.setOptions({
        gfm: true,
        breaks: false,
    })
    configureMarked.initialized = true
}

const renderMarkdown = (node, text) => {
    if (node) {
        configureMarked()

        const parseText = window.marked ? marked.parse(text) : text
        node.innerHTML = window.DOMPurify ? DOMPurify.sanitize(parseText) : parseText

        if (window.renderMathInElement) {
            renderMathInElement(node, {
                throwOnError: false,
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\(', right: '\\)', display: false },
                    { left: '\\[', right: '\\]', display: true },
                ],
            })
        }

        if (window.hljs) {
            node.querySelectorAll('pre code').forEach(block => {
                window.hljs.highlightElement(block)
            })
        }
    }
}

const escapeHTML = text => String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const formatRelativeTime = timestamp => {
    if (!timestamp) return ''

    const diff = Math.max(0, Date.now() - timestamp * 1000)
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (days > 0) return `${days}d`
    if (hours > 0) return `${hours}h`
    if (minutes > 0) return `${minutes}m`
    return 'now'
}

window.addEventListener('DOMContentLoaded', function () {
    const $textarea = document.querySelector('#contents')
    const $loading = document.querySelector('#loading')
    const $saveBtn = document.querySelector('.opt-save')
    const $saveStatus = document.querySelector('.save-status')
    const $homeNotesList = document.querySelector('#home-notes-list')
    const $homeNotesEmpty = document.querySelector('#home-notes-empty')
    const $pwBtn = document.querySelector('.opt-pw')
    const $modeBtn = document.querySelector('.opt-mode > input')
    const $shareBtn = document.querySelector('.opt-share > input')
    const $previewPlain = document.querySelector('#preview-plain')
    const $previewMd = document.querySelector('#preview-md')
    const $shareModal = document.querySelector('.share-modal')
    const $closeBtn = document.querySelector('.share-modal .close-btn')
    const $copyBtn = document.querySelector('.share-modal .opt-button')
    const $shareInput = document.querySelector('.share-modal input')
    const getTextareaValue = () => $textarea ? $textarea.value : ''

    if ($textarea) {
        renderPlain($previewPlain, getTextareaValue())
        renderMarkdown($previewMd, getTextareaValue())
    }

    let lastSavedValue = getTextareaValue()
    let pendingSave = false
    let saving = false

    const hasUnsavedChanges = () => !!$textarea && $textarea.value !== lastSavedValue

    const setSaveState = (state) => {
        if (!$saveStatus || !$saveBtn) return

        const textMap = {
            saved: getI18n('saved'),
            saving: getI18n('saving'),
            dirty: getI18n('unsaved'),
            error: getI18n('saveFailed'),
        }

        $saveStatus.className = `save-status is-${state}`
        $saveStatus.innerHTML = textMap[state]
        $saveBtn.disabled = state === 'saving' || !hasUnsavedChanges()
    }

    const createNotesMarkup = (note) => {
        const currentPath = window.location.pathname.replace(/^\//, '')
        const tags = [
            note.locked ? `<span class="notes-badge is-locked">${getI18n('noteEncrypted')}</span>` : '',
            note.share ? `<span class="notes-badge is-shared">${getI18n('noteShared')}</span>` : '',
        ].filter(Boolean).join('')

        return `
            <a class="home-note-card ${note.path === currentPath ? 'is-active' : ''}" href="/${note.path}">
                <div class="home-note-card-header">
                    <div class="home-note-card-title">${escapeHTML(note.title)}</div>
                    <span class="home-note-card-open">${getI18n('noteOpen')}</span>
                </div>
                <div class="home-note-card-path">/${escapeHTML(note.path)}</div>
                <div class="home-note-card-meta">
                    <span>${formatRelativeTime(note.updateAt)}</span>
                    <span class="notes-item-tags">${tags}</span>
                </div>
            </a>
        `
    }

    const renderNotesBlock = (container, empty, notes) => {
        if (!container || !empty) return

        if (!notes.length) {
            container.innerHTML = ''
            empty.innerHTML = getI18n('notesEmpty')
            empty.style.display = 'block'
            return
        }

        empty.style.display = 'none'
        container.innerHTML = notes.map(note => createNotesMarkup(note)).join('')
    }

    const renderNotes = (notes) => {
        renderNotesBlock($homeNotesList, $homeNotesEmpty, notes)
    }

    const fetchNotes = () => {
        if (!$homeNotesList) return Promise.resolve()

        if ($homeNotesEmpty) {
            $homeNotesEmpty.innerHTML = getI18n('notesLoading')
            $homeNotesEmpty.style.display = 'block'
        }

        return window.fetch('/api/notes')
            .then(res => res.json())
            .then(res => {
                if (res.err !== 0) {
                    throw new Error(res.msg)
                }
                renderNotes(res.data || [])
            })
            .catch(err => {
                if ($homeNotesList) $homeNotesList.innerHTML = ''
                if ($homeNotesEmpty) $homeNotesEmpty.innerHTML = getI18n('notesLoadFailed')
                errHandle(err)
            })
    }

    const saveContent = () => {
        if (!$textarea) return Promise.resolve(true)
        if (saving) {
            pendingSave = true
            return Promise.resolve(false)
        }

        if (!hasUnsavedChanges()) {
            setSaveState('saved')
            return Promise.resolve(true)
        }

        saving = true
        pendingSave = false
        setSaveState('saving')
        $loading.style.display = 'inline-block'

        const data = {
            t: getTextareaValue(),
        }

        return window.fetch('', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(data),
        })
            .then(res => res.json())
            .then(res => {
                if (res.err !== 0) {
                    throw new Error(res.msg)
                }

                lastSavedValue = getTextareaValue()
                setSaveState('saved')
                return fetchNotes().then(() => true)
            })
            .catch(err => {
                setSaveState('error')
                errHandle(err)
                return false
            })
            .finally(() => {
                saving = false
                $loading.style.display = 'none'

                if (pendingSave) {
                    pendingSave = false
                    saveContent()
                }
            })
    }

    const promptPendingChanges = () => {
        if (!hasUnsavedChanges()) return Promise.resolve(true)

        return Promise.resolve(window.confirm(getI18n('leaveDiscardConfirm')))
    }

    if ($textarea) {
        setSaveState('saved')
        fetchNotes()

        $textarea.oninput = function () {
            renderPlain($previewPlain, getTextareaValue())
            renderMarkdown($previewMd, getTextareaValue())
            setSaveState('dirty')
        }

        window.addEventListener('beforeunload', function (event) {
            if (!hasUnsavedChanges()) return

            event.preventDefault()
            event.returnValue = getI18n('beforeUnloadPrompt')
            return getI18n('beforeUnloadPrompt')
        })
    } else {
        fetchNotes()
    }

    document.addEventListener('click', function (event) {
        if (!hasUnsavedChanges()) return
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

        const link = event.target.closest('a[href]')
        if (!link || link.target === '_blank' || link.hasAttribute('download')) return

        const href = link.getAttribute('href')
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return

        const targetUrl = new URL(link.href, window.location.origin)
        if (targetUrl.href === window.location.href) return

        event.preventDefault()
        promptPendingChanges().then(shouldContinue => {
            if (shouldContinue) {
                window.location.href = targetUrl.href
            }
        })
    })

    if ($saveBtn) {
        $saveBtn.onclick = function () {
            saveContent()
        }
    }

    if ($pwBtn) {
        $pwBtn.onclick = function () {
            const passwd = window.prompt(getI18n('enpw'))
            if (passwd == null) return;

            const path = window.location.pathname
            window.fetch(`${path}/pw`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    passwd: passwd.trim(),
                }),
            })
                .then(res => res.json())
                .then(res => {
                    if (res.err !== 0) {
                        return errHandle(res.msg)
                    }
                    alert(passwd ? getI18n('pwss') : getI18n('pwrs'))
                    fetchNotes()
                })
                .catch(err => errHandle(err))
        }
    }

    if ($modeBtn) {
        $modeBtn.onchange = function (e) {
            const isMd = e.target.checked
            const path = window.location.pathname
            promptPendingChanges().then(shouldContinue => {
                if (!shouldContinue) {
                    e.target.checked = !isMd
                    return
                }

                window.fetch(`${path}/setting`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        mode: isMd ? 'md' : 'plain',
                    }),
                })
                    .then(res => res.json())
                    .then(res => {
                        if (res.err !== 0) {
                            e.target.checked = !isMd
                            return errHandle(res.msg)
                        }

                        window.location.reload()
                    })
                    .catch(err => {
                        e.target.checked = !isMd
                        errHandle(err)
                    })
            })
        }
    }

    if ($shareBtn) {
        $shareBtn.onclick = function (e) {
            const isShare = e.target.checked
            const path = window.location.pathname
            window.fetch(`${path}/setting`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    share: isShare,
                }),
            })
                .then(res => res.json())
                .then(res => {
                    if (res.err !== 0) {
                        return errHandle(res.msg)
                    }

                    if (isShare) {
                        const origin = window.location.origin
                        const url = `${origin}/share/${res.data}`
                        // show modal
                        if ($shareInput && $shareModal) {
                            $shareInput.value = url
                            $shareModal.style.display = 'block'
                        }
                    }

                    fetchNotes()
                })
                .catch(err => errHandle(err))
        }
    }

    if ($shareModal && $closeBtn && $copyBtn && $shareInput) {
        $closeBtn.onclick = function () {
            $shareModal.style.display = 'none'

        }
        $copyBtn.onclick = function () {
            clipboardCopy($shareInput.value)
            const originText = $copyBtn.innerHTML
            const originColor = $copyBtn.style.background
            $copyBtn.innerHTML = getI18n('cpys')
            $copyBtn.style.background = 'orange'
            window.setTimeout(() => {
                $shareModal.style.display = 'none'
                $copyBtn.innerHTML = originText
                $copyBtn.style.background = originColor
            }, 1500)
        }
    }

})
