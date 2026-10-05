let log = () => {};
const OWNER_UIN = '747403032';

export function setup(api) {
    log = api.log;

    // ── 工具 0：内部用，取触发者 QQ ──
    function getSenderId(ctx) {
        const trigger = ctx.session?.trigger || [];
        const last = trigger[trigger.length - 1];
        return String(last?.senderId || '');
    }

    function isOwner(ctx) {
        return getSenderId(ctx) === OWNER_UIN;
    }

    // ── 工具 1：列好友 ──
    api.registerTool({
        id: 'list_friends',
        name: '列出好友',
        description: '列出机器人的 QQ 好友。可选关键词筛选。只有主人能调用。',
        category: 'utility',
        parameters: {
            type: 'object',
            properties: {
                keyword: { type: 'string', description: '可选。按昵称或备注模糊筛选。' }
            }
        },
        async execute(ctx, args) {
            if (!isOwner(ctx)) return { content: '这个功能只有永江蓝能用。', isError: true };

            try {
                const friends = await ctx.onebot.call('get_friend_list');
                if (!Array.isArray(friends)) {
                    return { content: `接口返回异常：${JSON.stringify(friends).slice(0, 200)}`, isError: true };
                }

                const kw = String(args?.keyword || '').trim().toLowerCase();
                const list = kw
                    ? friends.filter((f) =>
                        String(f.nickname || '').toLowerCase().includes(kw) ||
                        String(f.remark || '').toLowerCase().includes(kw)
                    )
                    : friends;

                const lines = list.slice(0, 20).map((f) => `${f.remark || f.nickname || '（无昵称）'}（${f.user_id}）`);
                const suffix = list.length > 20 ? `\n（还有 ${list.length - 20} 个未显示）` : '';
                return {
                    content: kw
                        ? `匹配「${kw}」的好友 ${list.length} 个：\n${lines.join('\n')}${suffix}`
                        : `共 ${friends.length} 个好友：\n${lines.join('\n')}${suffix}`
                };
            } catch (e) {
                return { content: `查询失败：${e.message}`, isError: true };
            }
        }
    });

    // ── 工具 2：找好友 ──
    api.registerTool({
        id: 'find_friend',
        name: '找好友',
        description: '按昵称或备注查找好友的 QQ 号。只有主人能调用。',
        category: 'utility',
        parameters: {
            type: 'object',
            properties: {
                keyword: { type: 'string', description: '昵称或备注的关键词。' }
            },
            required: ['keyword']
        },
        async execute(ctx, args) {
            if (!isOwner(ctx)) return { content: '这个功能只有永江蓝能用。', isError: true };

            const kw = String(args?.keyword || '').trim();
            if (!kw) return { content: '缺少关键词', isError: true };

            try {
                const friends = await ctx.onebot.call('get_friend_list');
                const kwLower = kw.toLowerCase();
                const matched = friends.filter((f) =>
                    String(f.nickname || '').toLowerCase().includes(kwLower) ||
                    String(f.remark || '').toLowerCase().includes(kwLower)
                );

                if (!matched.length) return { content: `没有找到匹配「${kw}」的好友。` };

                const lines = matched.map((f) => `${f.remark || f.nickname}（QQ: ${f.user_id}）`);
                return { content: `找到 ${matched.length} 个匹配：\n${lines.join('\n')}` };
            } catch (e) {
                return { content: `查找失败：${e.message}`, isError: true };
            }
        }
    });

    // ── 工具 3：发私聊 ──
    api.registerTool({
        id: 'send_private',
        name: '发私聊消息',
        description: '给指定 QQ 号发一条私聊消息。只有主人能调用。',
        category: 'messaging',
        parameters: {
            type: 'object',
            properties: {
                targetUin: { type: 'string', description: '目标 QQ 号' },
                text: { type: 'string', description: '要发送的文本内容' }
            },
            required: ['targetUin', 'text']
        },
        async execute(ctx, args) {
            if (!isOwner(ctx)) return { content: '这个功能只有永江蓝能用。', isError: true };

            const targetUin = String(args?.targetUin || '').trim();
            const text = String(args?.text || '').trim();
            if (!/^\d{5,12}$/.test(targetUin)) return { content: `目标 QQ 号格式不对：${targetUin}`, isError: true };
            if (!text) return { content: '消息内容不能为空', isError: true };

            try {
                await ctx.sender.sendTextBatch(`private:${targetUin}`, [text]);
                return { content: `已发送给 ${targetUin}：${text}` };
            } catch (e) {
                return { content: `发送失败：${e.message}`, isError: true };
            }
        }
    });

    // ── 工具 4：发群消息 ──
    api.registerTool({
        id: 'send_group',
        name: '发群消息',
        description: '给指定群号发一条消息。只有主人能调用。',
        category: 'messaging',
        parameters: {
            type: 'object',
            properties: {
                groupId: { type: 'string', description: '目标群号' },
                text: { type: 'string', description: '要发送的文本内容' }
            },
            required: ['groupId', 'text']
        },
        async execute(ctx, args) {
            if (!isOwner(ctx)) return { content: '这个功能只有永江蓝能用。', isError: true };

            const groupId = String(args?.groupId || '').trim();
            const text = String(args?.text || '').trim();
            if (!/^\d{5,12}$/.test(groupId)) return { content: `群号格式不对：${groupId}`, isError: true };
            if (!text) return { content: '消息内容不能为空', isError: true };

            try {
                await ctx.sender.sendTextBatch(`group:${groupId}`, [text]);
                return { content: `已发到群 ${groupId}：${text}` };
            } catch (e) {
                return { content: `发送失败：${e.message}`, isError: true };
            }
        }
    });

    // ── 工具 6：发排练室公告 ──
    const NOTICE_GROUP_ID = '1107808377'; // 唐可可的排练室

    api.registerTool({
        id: 'send_notice',
        name: '发排练室公告',
        description: '在「唐可可的排练室」群发一条群公告。只有主人能调用。',
        category: 'messaging',
        parameters: {
            type: 'object',
            properties: {
                content: { type: 'string', description: '公告正文' },
                pinned: { type: 'boolean', description: '是否置顶，默认否' }
            },
            required: ['content']
        },
        async execute(ctx, args) {
            if (!isOwner(ctx)) return { content: '这个功能只有永江蓝能用。', isError: true };

            const content = String(args?.content || '').trim();
            if (!content) return { content: '公告内容不能为空', isError: true };
            const pinned = Number(args?.pinned ? 1 : 0);

            try {
                await ctx.onebot.call('_send_group_notice', {
                    group_id: Number(NOTICE_GROUP_ID),
                    content: content,
                    pinned: pinned
                });
                return { content: `已在排练室发布公告：${content}` };
            } catch (e) {
                return { content: `发公告失败：${e.message}`, isError: true };
            }
        }
    });
}