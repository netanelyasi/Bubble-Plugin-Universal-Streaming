function(instance, properties, context) {
    if (instance.data.controller) {
        instance.data.controller.abort();
        instance.data.controller = null;
    }
    instance.publishState('output', '');
    instance.publishState('tokens', 0);
    instance.publishState('response_time', 0);
    instance.publishState('error', '');
    instance.publishState('is_loading', false);
    instance.data.isGenerating = false;
    instance.triggerEvent('output_cleared');
}
