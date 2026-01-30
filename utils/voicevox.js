const axios = require('axios');
const { createAudioPlayer, createAudioResource, StreamType } = require('@discordjs/voice');
const { Readable } = require('stream');

const VOICEVOX_URL = 'http://127.0.0.1:50021';

// 利用可能なキャラクターリスト
const VOICE_MAP = {
    'ずんだもん': 3,
    'めたん': 2,
    'ずん子': 1,
    'つむぎ': 8,
    '雨晴': 10,
    '冥鳴': 14,
};

// VOICEVOXで音声を生成・再生する関数
async function playVoicevox(text, connection, speakerId) {
    try {
        if (!text) return;

        // 音声合成クエリ作成
        const queryUrl = `${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`;
        const queryRes = await axios.post(queryUrl, {});

        // 音声合成実行
        const synthesisUrl = `${VOICEVOX_URL}/synthesis?speaker=${speakerId}`;
        const synthesisRes = await axios.post(synthesisUrl, queryRes.data, {
            responseType: 'arraybuffer'
        });

        // 再生リソース作成
        const buffer = Buffer.from(synthesisRes.data);
        const stream = Readable.from(buffer);
        const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });

        // 再生
        const player = createAudioPlayer();
        player.on('error', error => console.error('再生エラー: ', error));

        connection.subscribe(player);
        player.play(resource);
    } catch (error) {
        console.error('--- VOICEVOX Error ---');
        if (error.response) {
            console.error('Status: ', error.response.status);
        } else {
            console.error('Error Message: ', error.message);
        }
    }
}

// エクスポート
module.exports = { playVoicevox, VOICE_MAP };
