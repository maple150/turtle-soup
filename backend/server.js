// server.js
// Node.js 后端服务器

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.static('public')); // 托管前端文件
app.use(express.json()); // 解析JSON请求体

// ⚠️ 配置区：你的 API Key
const DASHSCOPE_API_KEY = "sk-6533c949f54f4a088680624b03c16b4c"; // 你的公开密钥
const DASHSCOPE_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation";

/**
 * 调用 Qwen API 获取回答
 * @param {string} question - 汤面
 * @param {string} answer - 汤底
 * @param {string} guess - 用户猜测
 * @returns {Promise<string>} AI的回答
 */
async function getAIResponse(question, answer, guess) {
    // 构造提示词 (Prompt)
    const prompt = `
你是海龟汤游戏的主持人。请根据以下信息回答玩家。

【汤面】
${question}

【汤底】
${answer}

【玩家猜测】
${guess}

规则：
1. 如果猜测符合逻辑或接近真相，回复“是”。
2. 如果猜测错误，回复“否”。
3. 如果猜测与剧情无关，回复“无关”。
4. 严禁透露汤底内容。

请只回复一个词：“是”、“否”或“无关”。
    `.trim();

    try {
        const response = await axios.post(
            DASHSCOPE_URL,
            {
                model: "qwen-turbo", // 使用速度较快的模型
                input: {
                    messages: [
                        {
                            role: "user",
                            content: prompt
                        }
                    ]
                },
                parameters: {
                    result_format: "message"
                }
            },
            {
                headers: {
                    "Authorization": `Bearer ${DASHSCOPE_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        // 提取AI的回答
        return response.data.output.choices[0].message.content.trim();
    } catch (error) {
        console.error("AI API Error:", error.response?.data || error.message);
        throw new Error("AI服务暂时不可用");
    }
}

// API 路由
app.post('/api/guess', async (req, res) => {
    const { question, answer, guess } = req.body;

    if (!question || !answer || !guess) {
        return res.status(400).json({ error: "缺少必要参数" });
    }

    try {
        const aiReply = await getAIResponse(question, answer, guess);
        res.json({ reply: aiReply });
    } catch (error) {
        res.status(500).json({ reply: "AI服务错误，请稍后再试" });
    }
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});