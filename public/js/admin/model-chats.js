$(document).ready(function() {
  // Cron settings form submission
  $('#cronSettingsForm').on('submit', function(e) {
    e.preventDefault();
    
    const settings = {
      schedule: $('#cronSchedule').val(),
      enabled: $('#cronEnabled').is(':checked'),
      nsfw: $('#cronNsfw').is(':checked')
    };
    
    $.ajax({
      url: '/admin/model-chats/cron-settings',
      type: 'POST',
      data: settings,
      dataType: 'json',
      success: function(data) {
        if (data.success) {
          Swal.fire({
            title: 'Success!',
            text: 'Cron settings updated successfully.',
            icon: 'success',
            confirmButtonText: 'Great!'
          });
          
          // Update status display
          $('#jobStatus').removeClass('bg-success bg-danger')
            .addClass(settings.enabled ? 'bg-success' : 'bg-danger')
            .text(settings.enabled ? 'Active' : 'Inactive');
          
          $('#contentType').text(settings.nsfw ? 'NSFW Included' : 'SFW Only');
          $('#nextRun').text(data.nextRun || 'N/A');
        } else {
          Swal.fire({
            title: 'Error!',
            text: data.error || 'Failed to update cron settings',
            icon: 'error',
            confirmButtonText: 'OK'
          });
        }
      },
      error: function(xhr) {
        Swal.fire({
          title: 'Error!',
          text: xhr.responseJSON?.error || 'An unknown error occurred',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    });
  });
  
  // Generate individual chat button click
  $('.generate-chat-btn').on('click', function() {
    const modelId = $(this).data('model-id');
    const modelName = $(this).data('model-name');
    
    $('#modelName').text(modelName);
    $('#loadingPrompt').removeClass('d-none');
    $('#promptPreview').addClass('d-none');
    $('#noPrompt').addClass('d-none');
    $('#errorFetching').addClass('d-none');
    $('#generationResult').addClass('d-none');
    $('#generateBtn').addClass('d-none');
    $('#viewCharacterLink').addClass('d-none');
    
    $('#generateChatModal').modal('show');
    
    // Fetch a preview prompt
    $.ajax({
      url: '/api/preview-prompt',
      type: 'POST',
      data: { modelId, modelName },
      dataType: 'json',
      success: function(data) {
        $('#loadingPrompt').addClass('d-none');
        
        if (data.error) {
          $('#errorFetching').removeClass('d-none').text(data.error);
          return;
        }
        
        if (!data.prompt) {
          $('#noPrompt').removeClass('d-none');
          return;
        }
        
        // Show prompt preview
        $('#promptPreview').removeClass('d-none');
        $('#promptImage').attr('src', data.prompt.imageUrl);
        $('#promptText').text(data.prompt.prompt);
        $('#generateBtn').removeClass('d-none').data('model-id', modelId);
      },
      error: function() {
        $('#loadingPrompt').addClass('d-none');
        $('#errorFetching').removeClass('d-none');
      }
    });
  });
  
  // Generate button in modal click
  $('#generateBtn').on('click', function() {
    const modelId = $(this).data('model-id');
    
    $(this).prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generating...');
    
    // Use the NSFW setting from the cron settings form
    const nsfw = $('#cronNsfw').is(':checked');
    
    // Generate the chat
    $.ajax({
      url: '/admin/model-chats/generate',
      type: 'POST',
      data: { modelId, nsfw },
      dataType: 'json',
      success: function(data) {
        $('#generateBtn').prop('disabled', false).text('Generate');
        
        if (data.error) {
          $('#generationResult').removeClass('d-none alert-success').addClass('alert-danger');
          $('#generationMessage').text(data.error);
          return;
        }
        
        if (data.success) {
          const chat = data.chat;
          $('#generationResult').removeClass('d-none alert-danger').addClass('alert-success');
          $('#generationMessage').text('Character generated successfully!');
          
          if (chat && chat._id) {
            $('#viewCharacterLink').removeClass('d-none').attr('href', '/chat/' + chat._id);
          }
          
          // Reload the page after a delay to show the new chat
          setTimeout(function() {
            location.reload();
          }, 3000);
        } else {
          $('#generationResult').removeClass('d-none alert-success').addClass('alert-danger');
          $('#generationMessage').text('Failed to generate character.');
        }
      },
      error: function(xhr) {
        $('#generateBtn').prop('disabled', false).text('Generate');
        $('#generationResult').removeClass('d-none alert-success').addClass('alert-danger');
        $('#generationMessage').text(xhr.responseJSON?.error || 'An unknown error occurred');
      }
    });
  });
  
  // Generate all chats button click
  $('#generateAllChats').on('click', function() {
    Swal.fire({
      title: 'Generate All Model Chats?',
      text: 'This will generate chats for all models and may take some time.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, generate all',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        // Use the NSFW setting from the cron settings form
        const nsfw = $('#cronNsfw').is(':checked');
        
        // Show loading indicator
        $('#loadingModal').modal('show');
        
        $.ajax({
          url: '/admin/model-chats/generate',
          type: 'POST',
          data: { nsfw },
          dataType: 'json',
          success: function(data) {
            $('#loadingModal').modal('hide');
            
            if (data.success) {
              const successes = data.results.filter(r => r.status === 'success').length;
              const failures = data.results.filter(r => r.status !== 'success').length;
              
              Swal.fire({
                title: 'Generation Complete',
                text: `Successfully generated ${successes} chats. Failed: ${failures}.`,
                icon: 'success',
                confirmButtonText: 'Great!'
              }).then(() => {
                location.reload();
              });
            } else {
              Swal.fire({
                title: 'Error!',
                text: data.error || 'Failed to generate chats',
                icon: 'error',
                confirmButtonText: 'OK'
              });
            }
          },
          error: function(xhr) {
            $('#loadingModal').modal('hide');
            
            Swal.fire({
              title: 'Error!',
              text: xhr.responseJSON?.error || 'An unknown error occurred',
              icon: 'error',
              confirmButtonText: 'OK'
            });
          }
        });
      }
    });
  });
});
