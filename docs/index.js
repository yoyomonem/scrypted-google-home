document.addEventListener("DOMContentLoaded", function(event) {
    const options = new cast.framework.CastReceiverOptions();
    options.disableIdleTimeout = true;
  
    cast.framework.CastReceiverContext.getInstance().start(options);
  
    const context = cast.framework.CastReceiverContext.getInstance();
    const playerManager = context.getPlayerManager();
  
    // intercept the LOAD request to be able to read in a contentId and get data
    playerManager.setMessageInterceptor(cast.framework.messages.MessageType.LOAD, loadRequestData => {
      console.log(loadRequestData);
  
      const wsUrl = loadRequestData.media.entity || loadRequestData.media.contentId;
      const credentials = loadRequestData.credentials ? JSON.parse(loadRequestData.credentials) : loadRequestData.media.customData;
  
    //   rtc.then(function(rtcManager) {
    //     rtcManager.connect({
    //         senderId: senderId,
    //         registrationId: registrationId,
    //         port: rtspUrl,
    //         offerToReceiveAudio: 1,
    //         offerToReceiveVideo: 1,
    //     })
    //     .then(function(conn, e) {
    //         console.log('connected', conn);
    //         document.getElementById('media').srcObject = conn.peerConnection.getRemoteStreams()[0];
    //     });
    //   })
  
      return null;
    });
  });
  