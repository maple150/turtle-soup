// 获取题目（这里可以是静态的，也可以从后端获取）
const soup = {
    question: "男子深夜在酒吧点了一杯冰水，喝完后拔枪自尽，为什么？",
    answer: "他是酒保。刚才他不小心把冰块掉在了地上，顾客喝的是没加冰的威士忌。他以为自己犯了大错，出于愧疚自杀了。"
};

document.getElementById("problem").innerText = "题目：" + soup.question;

async function askAI() {
    const input = document.getElementById("guessInput").value;
    const responseDiv = document.getElementById("response");
    
    responseDiv.innerText = "思考中...";
    
    // 调用同项目的后端函数
    const res = await fetch("/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            guess: input, 
            answer: soup.answer 
        }),
    });
    
    const data = await res.json();
    responseDiv.innerText = "AI回答：" + data.reply;
}