import dayjs from 'dayjs'
import { Router } from 'itty-router'
import Cookies from 'cookie'
import jwt from '@tsndr/cloudflare-worker-jwt'
import { queryNote, MD5, checkAuth, genRandomStr, returnPage, returnJSON, saltPw, getI18n } from './helper'
import { SECRET, SUPPORTED_LANG } from './constant'

// init
const router = Router()
const SHARE_CODE_LENGTH = 6

const getShareCode = async (path, metadata = {}) => {
    if (metadata.shareCode) {
        const existedPath = await SHARE.get(metadata.shareCode)
        if (!existedPath || existedPath === path) {
            return metadata.shareCode
        }
    }

    for (let i = 0; i < 20; i++) {
        const shareCode = genRandomStr(SHARE_CODE_LENGTH)
        const existedPath = await SHARE.get(shareCode)

        if (!existedPath || existedPath === path) {
            return shareCode
        }
    }

    throw new Error('Generate share code failed!')
}

router.get('/', request => {
    const lang = getI18n(request)
    return returnPage('Home', {
        lang,
        title: SUPPORTED_LANG[lang].home,
    })
})

router.get('/new', ({ url }) => {
    const newHash = genRandomStr(3)
    const { origin } = new URL(url)
    return Response.redirect(`${origin}/${newHash}`, 302)
})

router.get('/share/:code', async (request) => {
    const lang = getI18n(request)
    const { code } = request.params
    const path = await SHARE.get(code)

    if (!!path) {
        const { value, metadata } = await queryNote(path)

        return returnPage('Share', {
            lang,
            title: decodeURIComponent(path),
            content: value,
            ext: metadata,
        })
    }

    return returnPage('Page404', { lang, title: '404' })
})

router.get('/api/notes', async () => {
    try {
        let cursor = undefined
        const notes = []

        while (true) {
            const result = await NOTES.list({
                cursor,
                limit: 1000,
            })

            result.keys.forEach(({ name, metadata = {} }) => {
                notes.push({
                    path: name,
                    title: decodeURIComponent(name),
                    updateAt: metadata.updateAt || 0,
                    mode: metadata.mode || 'plain',
                    share: !!metadata.share,
                    locked: !!metadata.pw,
                })
            })

            if (result.list_complete) {
                break
            }

            cursor = result.cursor
        }

        notes.sort((left, right) => {
            if ((right.updateAt || 0) !== (left.updateAt || 0)) {
                return (right.updateAt || 0) - (left.updateAt || 0)
            }
            return left.title.localeCompare(right.title)
        })

        return returnJSON(0, notes)
    } catch (error) {
        console.error(error)
    }

    return returnJSON(10005, 'List notes failed!')
})

router.get('/:path', async (request) => {
    const lang = getI18n(request)

    const { path } = request.params
    const title = decodeURIComponent(path)

    const cookie = Cookies.parse(request.headers.get('Cookie') || '')

    const { value, metadata } = await queryNote(path)

    if (!metadata.pw) {
        return returnPage('Edit', {
            lang,
            title,
            content: value,
            ext: metadata,
        })
    }

    const valid = await checkAuth(cookie, path)
    if (valid) {
        return returnPage('Edit', {
            lang,
            title,
            content: value,
            ext: metadata,
        })
    }

    return returnPage('NeedPasswd', { lang, title })
})

router.post('/:path/auth', async request => {
    const { path } = request.params
    if (request.headers.get('Content-Type') === 'application/json') {
        const { passwd } = await request.json()

        const { metadata } = await queryNote(path)

        if (metadata.pw) {
            const storePw = await saltPw(passwd)

            if (metadata.pw === storePw) {
                const token = await jwt.sign({ path }, SECRET)
                return returnJSON(0, {
                    refresh: true,
                }, {
                    'Set-Cookie': Cookies.serialize('auth', token, {
                        path: `/${path}`,
                        expires: dayjs().add(7, 'day').toDate(),
                        httpOnly: true,
                    })
                })
            }
        }
    }

    return returnJSON(10002, 'Password auth failed!')
})

router.post('/:path/pw', async request => {
    const { path } = request.params
    if (request.headers.get('Content-Type') === 'application/json') {
        const cookie = Cookies.parse(request.headers.get('Cookie') || '')
        const { passwd } = await request.json()

        const { value, metadata } = await queryNote(path)
        const valid = await checkAuth(cookie, path)

        if (!metadata.pw || valid) {
            const pw = passwd ? await saltPw(passwd) : undefined
            try {
                await NOTES.put(path, value, {
                    metadata: {
                        ...metadata,
                        pw,
                    },
                })

                return returnJSON(0, null, {
                    'Set-Cookie': Cookies.serialize('auth', '', {
                        path: `/${path}`,
                        expires: dayjs().subtract(100, 'day').toDate(),
                        httpOnly: true,
                    })
                })
            } catch (error) {
                console.error(error)
            }
        }

        return returnJSON(10003, 'Password setting failed!')
    }
})

router.post('/:path/setting', async request => {
    const { path } = request.params
    if (request.headers.get('Content-Type') === 'application/json') {
        const cookie = Cookies.parse(request.headers.get('Cookie') || '')
        const { mode, share } = await request.json()

        const { value, metadata } = await queryNote(path)
        const valid = await checkAuth(cookie, path)

        if (!metadata.pw || valid) {
            try {
                const legacyShareCode = await MD5(path)
                const nextMetadata = {
                    ...metadata,
                }

                if (mode !== undefined) {
                    nextMetadata.mode = mode
                }

                if (share !== undefined) {
                    nextMetadata.share = share
                }

                let shareCode = metadata.shareCode
                if (share) {
                    shareCode = await getShareCode(path, metadata)
                    nextMetadata.shareCode = shareCode
                }

                if (share === false) {
                    delete nextMetadata.shareCode
                }

                await NOTES.put(path, value, {
                    metadata: nextMetadata,
                })

                if (share) {
                    await SHARE.put(shareCode, path)

                    if (metadata.shareCode && metadata.shareCode !== shareCode) {
                        await SHARE.delete(metadata.shareCode)
                    }

                    if (legacyShareCode !== shareCode) {
                        await SHARE.delete(legacyShareCode)
                    }

                    return returnJSON(0, shareCode)
                }

                if (share === false) {
                    if (metadata.shareCode) {
                        await SHARE.delete(metadata.shareCode)
                    }

                    await SHARE.delete(legacyShareCode)
                }


                return returnJSON(0)
            } catch (error) {
                console.error(error)
            }
        }

        return returnJSON(10004, 'Update Setting failed!')
    }
})

router.post('/:path', async request => {
    const { path } = request.params
    const { value, metadata } = await queryNote(path)

    const cookie = Cookies.parse(request.headers.get('Cookie') || '')
    const valid = await checkAuth(cookie, path)

    if (!metadata.pw || valid) {
        // OK
    } else {
        return returnJSON(10002, 'Password auth failed! Try refreshing this page if you had just set a password.')
    }

    const formData = await request.formData();
    const content = formData.get('t')

    try {

        if (content?.trim()){
            // 有值修改
            await NOTES.put(path, content, {
                metadata: {
                    ...metadata,
                    updateAt: dayjs().unix(),
                },
            })
        }else{
            // 无值删除
            await NOTES.delete(path)
        }

        return returnJSON(0)
    } catch (error) {
        console.error(error)
    }

    return returnJSON(10001, 'KV insert fail!')
})

router.all('*', (request) => {
    const lang = getI18n(request)
    return returnPage('Page404', { lang, title: '404' })
})

addEventListener('fetch', event => {
    event.respondWith(router.handle(event.request))
})
