function(instance, properties, context) {
    const API_URL = (properties.api_url || '').trim();
    const API_KEY = (properties.api_key || '').trim();
    const model = (properties.model || 'gpt-4o').trim();
    const systemMessage = (properties.system || '').trim();
    const userInput = (properties.user || '').trim();
    const temperature = properties.temperature !== undefined ? properties.temperature : 0.7;
    const maxTokens = properties.max_tokens || 4096;

    let output = '';
    let buffer = '';
    let estimatedTokens = 0;
    const startTime = Date.now();

    instance.data.controller = new AbortController();
    const signal = instance.data.controller.signal;

    const validate = () => {
        const errors = [];
        if (!API_URL) errors.push('API URL is required');
        if (!API_KEY) errors.push('API Key is required');
        if (!userInput) errors.push('User input is required');
        if (errors.length > 0) {
            instance.publishState('error', errors.join('; '));
            instance.publishState('is_loading', false);
            instance.triggerEvent('error_occurred');
            return false;
        }
        return true;
    };

    const detectProvider = (url) => {
        const u = url.toLowerCase();
        if (u.includes('anthropic') || u.includes('claude')) return 'anthropic';
        if (u.includes('groq')) return 'groq';
        if (u.includes('together')) return 'together';
        if (u.includes('mistral')) return 'mistral';
        if (u.includes('deepseek')) return 'deepseek';
        return 'openai';
    };

    const buildPayload = (provider) => {
        let payload = {};
        let headers = { 'Content-Type': 'application/json' };

        if (provider === 'anthropic') {
            payload = {
                model: model,
                max_tokens: maxTokens,
                temperature: temperature,
                stream: true,
                messages: [{ role: 'user', content: userInput }]
            };
            if (systemMessage) payload.system = systemMessage;
            headers['x-api-key'] = API_KEY;
            headers['anthropic-version'] = '2023-06-01';
        } else {
            const messages = [];
            if (systemMessage) messages.push({ role: 'system', content: systemMessage });
            messages.push({ role: 'user', content: userInput });
            payload = { model, messages, temperature, max_tokens: maxTokens, stream: true };
            headers['Authorization'] = 'Bearer ' + API_KEY;
        }
        return { payload, headers };
    };

    const parseChunk = (provider, dataString) => {
        try {
            const data = JSON.parse(dataString);
            if (provider === 'anthropic') {
                if (data.type === 'content_block_delta' && data.delta) return data.delta.text || '';
                if (data.type === 'message_delta' && data.usage) estimatedTokens = data.usage.output_tokens;
                return '';
            } else {
                if (data.choices && data.choices[0] && data.choices[0].delta) {
                    if (data.usage) estimatedTokens = data.usage.total_tokens;
                    return data.choices[0].delta.content || '';
                }
                return '';
            }
        } catch (e) { return ''; }
    };

    const generate = async () => {
        if (!validate()) return;

        instance.data.isGenerating = true;
        instance.publishState('is_loading', true);
        instance.publishState('error', '');
        instance.publishState('output', '');

        const provider = detectProvider(API_URL);
        const { payload, headers } = buildPayload(provider);

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload),
                signal: signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                let msg = 'HTTP ' + response.status;
                try {
                    const ej = JSON.parse(errorText);
                    msg = (ej.error && ej.error.message) || ej.message || msg;
                } catch(e) { msg += ' - ' + errorText.substring(0,200); }
                throw new Error(msg);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                let idx = buffer.indexOf('\n');
                while (idx !== -1) {
                    const line = buffer.slice(0, idx).trim();
                    buffer = buffer.slice(idx + 1);
                    idx = buffer.indexOf('\n');

                    if (!line || line.startsWith('event:') || line.includes('[DONE]')) continue;

                    if (line.startsWith('data:')) {
                        const ds = line.slice(5).trim();
                        if (ds && ds !== '[DONE]') {
                            const text = parseChunk(provider, ds);
                            if (text) {
                                output += text;
                                instance.publishState('output', output);
                            }
                        }
                    }
                }
            }

            const responseTime = (Date.now() - startTime) / 1000;
            if (estimatedTokens === 0) {
                estimatedTokens = Math.ceil(((systemMessage||'').length + userInput.length + output.length) / 4);
            }

            instance.publishState('output', output);
            instance.publishState('response_time', responseTime);
            instance.publishState('tokens', estimatedTokens);
            instance.publishState('is_loading', false);
            instance.publishState('error', '');
            instance.data.isGenerating = false;
            instance.triggerEvent('output_generation_completed');

        } catch (error) {
            instance.data.isGenerating = false;
            instance.publishState('is_loading', false);
            if (signal.aborted) {
                instance.publishState('output', output);
                instance.triggerEvent('generation_stopped');
            } else {
                instance.publishState('error', error.message);
                instance.triggerEvent('error_occurred');
            }
        }
    };

    generate();
}
