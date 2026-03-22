// static CDN
export const CDN_PREFIX = '//gcore.jsdelivr.net/gh/s0urcelab/serverless-cloud-notepad@master/static'

// server side salt
export const SALT = SCN_SALT
// server side secret
export const SECRET = SCN_SECRET

// supported language
export const SUPPORTED_LANG = {
    'en': {
        allNotes: 'All Notes',
        newNote: 'New Note',
        notes: 'Notes',
        save: 'Save',
        saved: 'Saved',
        setPW: 'Set Password',
        changePW: 'Change Password',
        share: 'Share',
        lastModified: 'Last Modified',
        copy: 'Copy',
        emptyPH: 'There are many like it, but this one is mine...',
        emptyNotes: 'No notes yet.',
        tipEncrypt: 'This Note has been encrypted, please enter password!',
        tip404: '404, Nothing here',
    },
    'zh': {
        allNotes: '所有笔记',
        newNote: '新建笔记',
        notes: '笔记列表',
        save: '保存',
        saved: '已保存',
        setPW: '设置密码',
        changePW: '修改密码',
        share: '分享',
        lastModified: '上次保存',
        copy: '复制',
        emptyPH: '看来你是第一个到这儿的人，写点什么吧...',
        emptyNotes: '还没有任何笔记',
        tipEncrypt: '这是一篇加密笔记，你必须先输入密码',
        tip404: '404，你要找的东西并不存在',
    }
}
