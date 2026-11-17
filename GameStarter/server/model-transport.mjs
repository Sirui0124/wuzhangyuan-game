/** Two explicit wire formats, with one text-only result for the game. */
export const isMessagesEndpoint = baseUrl => /\/messages\/?$/.test(new URL(baseUrl).pathname);
export function modelRequest(config, { text, system, images = [], temperature }) {
  // Some gateways drop top-level Messages system instructions for non-Claude models.
  // An explicitly saved alternate endpoint preserves real system/user separation.
  const endpoint = system && config.systemBaseUrl ? config.systemBaseUrl : config.baseUrl;
  const messagesProtocol = isMessagesEndpoint(endpoint);
  const url = new URL(endpoint), path = url.pathname.replace(/\/+$/, '');
  url.pathname = messagesProtocol ? path : path.endsWith('/chat/completions') ? path : `${path}/chat/completions`;
  const imageBlock = image => {
    if (!messagesProtocol) return { type: 'image_url', image_url: { url: image } };
    if (image.startsWith('https://')) return { type: 'image', source: { type: 'url', url: image } };
    const match = /^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image);
    if (!match) throw new Error('Messages接口需要HTTPS图片或有效的base64图片');
    return { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } };
  };
  if (messagesProtocol && temperature !== undefined && temperature > 1) throw Object.assign(new Error('Messages接口temperature需在0到1之间'), { status: 400 });
  const content = images.length ? [...images.map(imageBlock), { type: 'text', text }] : text;
  const payload = { model: config.model, thinking: { type: 'disabled' }, stream: false,
    ...(messagesProtocol ? { max_tokens: 4096, ...(system ? { system } : {}) } : {}),
    messages: [...(!messagesProtocol && system ? [{ role: 'system', content: system }] : []), { role: 'user', content }],
    ...(temperature === undefined ? {} : { temperature }) };
  const headers = { 'Content-Type': 'application/json', ...(messagesProtocol
    ? { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' }
    : { Authorization: `Bearer ${config.apiKey}` }) };
  return { url: url.href, headers, payload, messagesProtocol };
}
export function modelText(result, messagesProtocol) {
  const complete = messagesProtocol ? result?.stop_reason === 'end_turn' : result?.choices?.[0]?.finish_reason === 'stop';
  const text = messagesProtocol ? result?.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') : result?.choices?.[0]?.message?.content;
  // Reasoning/thinking blocks and tool calls must never become player dialogue or JSON input.
  if (!complete || typeof text !== 'string' || !text.trim()) throw Object.assign(new Error('模型未返回完整文字回复'), { status: 502 });
  return { text, responseId: result.id, usage: result.usage };
}
export async function callModel(config, input, signal) {
  const request = modelRequest(config, input);
  const response = await fetch(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(request.payload), signal });
  if (!response.ok) {
    await response.body?.cancel();
    throw Object.assign(new Error(`模型接口请求失败（HTTP ${response.status}）`), { status: response.status });
  }
  return modelText(await response.json(), request.messagesProtocol);
}
