// 必要なクラスを読み込み
const { Client, GatewayIntentBits, ActivityType, Events } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
require('dotenv').config(); // .envファイルを読み込む

const { saveFile, loadFile } = require('./utils/storage');
const { playVoicevox, VOICE_MAP } = require('./utils/voicevox');

// クライアント(Bot)のインスタンスを作成
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,           // サーバーに関する情報
        GatewayIntentBits.GuildMessages,    // メッセージに関する情報
        GatewayIntentBits.MessageContent,   // メッセージの内容に関する情報
        GatewayIntentBits.GuildVoiceStates, // ボイスチャンネルに関する情報
    ],
});

// Botが現在接続している「コネクション」を保存しておく場所
let connection = null;

let dictionary = {};
let userSettings = {};

function initData() {
    dictionary = loadFile('dictionary.json');
    userSettings = loadFile('user_settings.json');
    console.log('データを読み込みました(暗号化対応済み)');
}
initData();


// Botが起動したときに1回だけ実行
client.once('clientReady', () => {
    console.log(`${client.user.tag} landed now!`);

    client.user.setPresence({
        activities: [{
            name: 'みんなの会話',
            type: ActivityType.Listening,
        }],
        status: 'online',
    });
});


// スラッシュコマンド処理
client.on(Events.InteractionCreate, async interaction => {
    // チャットコマンド以外は無視
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // --- /join ---
    if (commandName === 'join') {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            await interaction.reply({ content: 'まずはボイスチャンネルに入ってください!', ephemeral: true });
            return;
        }
        connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });
        await interaction.reply('接続しました!🔊');
    }

    // --- /leave ---
    else if (commandName === 'leave') {
        if (connection) {
            connection.destroy();
            connection = null;
            await interaction.reply('切断しました');
        } else {
            await interaction.reply({ content: '接続していません', ephemeral: true });
        }
    }

    // --- /voice ---
    else if (commandName === 'voice') {
        const charaName = interaction.options.getString('character');

        if (VOICE_MAP[charaName]) {
            userSettings[interaction.user.id] = VOICE_MAP[charaName];
            saveFile('user_settings.json', userSettings);
            await interaction.reply(`声を「${charaName}」に変更しました`);
        } else {
            const list = Object.keys(VOICE_MAP).join('，');
            await interaction.reply({ content: `そのキャラは登録されていません。\n使えるキャラ: ${list}`, ephemeral: true });
        }
    }

    // --- /add ---
    else if (commandName === 'add') {
        const word = interaction.options.getString('word');
        const reading = interaction.options.getString('reading');

        dictionary[word] = reading;
        saveFile('dictionary.json', dictionary);
        await interaction.reply(`辞書登録: ${word} → ${reading} 📝`);
    }
});

// 読み上げ処理
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!')) return;

    if (!connection) return;
    // --- フィルタリング処理 ---
    // メンションをIDではなく名前に変換したテキストを取得
    let text = message.cleanContent;

    // 辞書適用
    for (const [word, reading] of Object.entries(dictionary)) {
        text = text.split(word).join(reading);
    }

    // フィルタリング
    text = text.replace(/```[\s\S]*?```/g, '');
    text = text.replace(/https?:\/\/[^\s]+/g, 'URL');
    text = text.replace(/<a?:.+?:\d+>/g, '');
    if (!text.trim()) return;

    // 6. 文字数が多すぎる場合はかっとする
    if (text.length > 100) {
        text = text.substring(0, 100) + '，以下省略';
    }

    const speakerId = userSettings[message.author.id] || 3;
    await playVoicevox(text, connection, speakerId);
});

// Botにログインする
client.login(process.env.DISCORD_TOKEN);
