function(instance, properties, context) {
    // Clear the output
    instance.publishState('output', '');
    
    // Reset the token count
    instance.publishState('tokens', 0);
    
    // Reset the response time
    instance.publishState('response_time', 0);
    
    // Add a log message
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] Output cleared`;
    
    // Update the log if it exists, or create a new one
    let currentLog = instance.data.log || [];
    currentLog.push(logMessage);
    instance.data.log = currentLog;
    
    // Publish the updated log
    instance.publishState('log', currentLog.join('\n'));
    
    // Trigger an event to indicate that the output has been cleared
    if (instance.triggerEvent) {
        instance.triggerEvent('output_cleared');
    }
}