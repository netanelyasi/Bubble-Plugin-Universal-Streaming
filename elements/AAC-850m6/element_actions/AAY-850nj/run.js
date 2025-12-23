function(instance, properties, context) {
    const API_URL = properties.api_url;
    const API_KEY = properties.api_key;
    const model = properties.model;
    const systemMessage = properties.system;
    const userInput = properties.user;
    const temperature = properties.temperature || 0.7;
    let output = "";
    let controller = null;
    let buffer = "";
    let tokens = 0;
    const startTime = Date.now();

    const generate = async () => {
        if (!API_URL) {
            alert("Please enter an API URL.");
            return;
        }

        if (!API_KEY) {
            alert("Please enter an API key.");
            return;
        }

        if (!userInput) {
            alert("Please enter a prompt.");
            return;
        }

        output = "Generating...";
        controller = new AbortController();
        const signal = controller.signal;

        try {
            let payload = {};
            let headers = {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_KEY}`
            };

            // התאמה למבנה ה-Payload בהתאם לסוג השירות
            if (API_URL.includes("anthropic")) {
                // מבנה ה-Payload עבור Anthropic
                const messages = [];
                if (systemMessage) {
                    messages.push({ role: "system", content: [{ type: "text", text: systemMessage }] });
                }
                messages.push({ role: "user", content: [{ type: "text", text: userInput }] });

                payload = {
                    model: model,
                    max_tokens: 1024, // אפשר להגדיר את הערך לפי הצורך
                    messages: messages,
                    temperature: temperature,
                    stream: true
                };
                headers["anthropic-version"] = "2023-06-01"; // גרסת API עדכנית של Anthropic
            } else {
                // מבנה ה-Payload עבור שירותים אחרים כמו OpenAI
                const messages = [];
                if (systemMessage) {
                    messages.push({ role: "system", content: systemMessage });
                }
                messages.push({ role: "user", content: userInput });

                payload = {
                    model: model,
                    messages: messages,
                    temperature: temperature,
                    stream: true
                };
            }

            const response = await fetch(API_URL, {
                method: "POST",
                headers: headers,
                body: JSON.stringify(payload),
                signal
            });

            if (!response.ok) {
                const errorMessage = await response.text();
                alert(`Error: ${response.status} - ${response.statusText}\n${errorMessage}`);
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            output = "";
            const updateOutput = () => {
                instance.publishState('output', output);
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                const chunk = decoder.decode(value);
                buffer += chunk;

                let boundary = buffer.indexOf("\n\n");
                while (boundary !== -1) {
                    let message = buffer.slice(0, boundary).trim();
                    buffer = buffer.slice(boundary + 2);
                    boundary = buffer.indexOf("\n\n");

                    if (message !== "" && !message.includes("[DONE]")) {
                        if (message.startsWith("data:")) {
                            const dataString = message.replace("data: ", "");
                            try {
                                const data = JSON.parse(dataString);
                                let text = "";

                                if (API_URL.includes("anthropic")) {
                                    // טיפול בתגובה של Anthropic
                                    text = data.content[0].text || "";
                                } else {
                                    // טיפול בתגובה של OpenAI ודומיו
                                    text = data.choices[0].delta?.content || "";
                                }

                                if (text) {
                                    output += text;
                                    tokens += text.split(" ").length; // חישוב מספר ה-tokens
                                    updateOutput();
                                }
                            } catch (error) {
                                console.error(`Error parsing JSON: ${dataString}\n${error}`);
                            }
                        }
                    }
                }
            }

            const endTime = Date.now();
            const responseTime = (endTime - startTime) / 1000; // חישוב זמן התגובה בשניות

            // פרסום הסטייטים
            instance.publishState('output', output);
            instance.publishState('response_time', responseTime);
            instance.publishState('tokens', tokens);
            instance.triggerEvent('output_generation_completed');

        } catch (error) {
            if (signal.aborted) {
                console.log("Request aborted.");
            } else {
                console.error("Error:", error);
            }
        }
    };

    generate();
}
