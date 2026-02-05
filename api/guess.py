import os
import sys
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
import httpx

# --- ⚠️ 危险操作：直接写入密钥 ---
# 请将此处的密钥替换为你自己的
DASHSCOPE_API_KEY = "sk-6533c949f54f4a088680624b03c16b4c" 

async def guess_endpoint(request):
    if request.method == 'POST':
        data = await request.json()
        user_guess = data.get('guess', '')
        true_answer = data.get('answer', '')

        # 构造提示词给Qwen
        prompt = f"""
        你是一个海龟汤裁判。根据真相判断用户的猜测。
        真相：{true_answer}
        用户猜测：{user_guess}
        规则：如果猜对了核心逻辑，回复“是”；如果猜错，回复“否”；如果无关，回复“无关”。
        只回答一个词。
        """

        # 调用 DashScope API (简化示例，实际需处理HTTP请求)
        # 这里需要使用 httpx 或 requests 发送请求到 DashScope
        # 由于 Pages Functions 环境限制，建议使用异步 httpx
        
        # 模拟响应 (为了演示，实际应替换为真实的API调用)
        # real_response = await call_qwen_api(prompt)
        
        # 为了能跑通，这里先用模拟逻辑
        if "酒保" in user_guess or "威士忌" in user_guess:
            reply = "是"
        else:
            reply = "否"

        return JSONResponse({"reply": reply})

    return JSONResponse({"error": "Method not allowed"}, status_code=405)

app = Starlette(routes=[
    Route('/api/guess', guess_endpoint, methods=['POST', 'GET'])
])