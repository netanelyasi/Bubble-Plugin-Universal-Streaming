function(instance, context) {
    instance.data = instance.data || {};
    instance.data.controller = null;
    instance.data.isGenerating = false;
    instance.publishState('output', '');
    instance.publishState('response_time', 0);
    instance.publishState('tokens', 0);
    instance.publishState('error', '');
    instance.publishState('is_loading', false);
    console.log('[Universal Streaming] Initialized');
}
