// 卡密兑换 / 余额查询
const {
    getCardsStore,
    getCard,
    cardPublicView,
    bumpStat
} = require('./shared/card-store.js');

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return jsonResponse(204, {});
    }
    if (event.httpMethod !== 'POST') {
        return jsonResponse(405, { error: '只支持 POST 请求' });
    }

    try {
        let body;
        try {
            body = JSON.parse(event.body || '{}');
        } catch {
            return jsonResponse(400, { error: '请求内容不是有效 JSON' });
        }

        const store = await getCardsStore();
        const card = await getCard(store, body.code);
        if (!card) {
            return jsonResponse(404, { error: '卡密不存在或输入有误，请核对后重试', code: 'CARD_INVALID' });
        }
        if (card.disabled) {
            return jsonResponse(200, { ok: false, message: '该卡密已被停用，请联系卖家', code: 'CARD_DISABLED' });
        }

        await bumpStat('redeem');
        return jsonResponse(200, { ok: true, card: cardPublicView(card) });
    } catch (error) {
        return jsonResponse(error.statusCode || 500, { error: error.message || '卡密查询失败' });
    }
};

function jsonResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Card-Code'
        },
        body: statusCode === 204 ? '' : JSON.stringify(body)
    };
}
