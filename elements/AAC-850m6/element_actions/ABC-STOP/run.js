function(instance, properties, context) {
    if (instance.data.controller) {
        instance.data.controller.abort();
        instance.data.controller = null;
        instance.publishState('is_loading', false);
        instance.data.isGenerating = false;
        instance.triggerEvent('generation_stopped');
    }
}
