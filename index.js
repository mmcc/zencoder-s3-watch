var path     = require('path');
var zencoder = require('zencoder')();
var AWS      = require('aws-sdk');
var _        = require('lodash');

var credentials = new AWS.SharedIniFileCredentials({profile: 'personal'});
AWS.config.credentials = credentials;

var s3 = new AWS.S3();

var options = {
  inbox: 'watch-inbox',
  outbox: 'watch-outbox',
  processing: 'watch-processed',
  notification: 'http://requestb.in/zhybyczh'
};

var checkInbox = function() {
  s3.listObjects({
    Bucket: options.inbox,
  }, function(err, data) {
    if (err) return handleError(err);

    if (_.isEmpty(data.Contents)) {
      console.log('No videos found.');
      return;
    }

    processBucketContents(data.Contents);
  });

  setTimeout(checkInbox, 10000);
};

var processBucketContents = function(contents) {
  console.log(contents.length + ' items found in inbox.');
  _.forEach(contents, function(video) {
    processVideo(video);
  });
};

var processVideo = function(video) {
  console.log('Processing '+ video.Key);

  moveFileToProcessing(video.Key, function(err, video) {
    if (err) return handleError(err);

    createZencoderRequest(video);
    deleteInboxItem(video);
  });


};

var moveFileToProcessing = function(video, cb) {
  console.log('Moving '+ video +' to processing folder.');

  s3.copyObject({
    Bucket: options.processing,
    CopySource: options.inbox +'/'+ video,
    Key: video
  }, function(err, data) {
    if (err) return cb(err);

    cb(null, video);
  });
};

var createZencoderRequest = function(video) {
  console.log('Creating API request for '+ video);
  var apiRequest = buildRequest(video);

  zencoder.Job.create(apiRequest, function(err, data) {
    if (err) return handleError(err);
    console.log(video +' is processing');
  });
};

var deleteInboxItem = function(video) {
  console.log('Deleting '+ video +' from inbox');
  s3.deleteObject({
    Bucket: options.inbox,
    Key: video
  }, function(err, data) {
    if (err) return handleError(err);

    console.log('Deleted '+ video +' from inbox');
  });
};

var removeExtension = function(filename) {
  return path.basename(filename, path.extname(filename));
};

var buildRequest = function(input) {
  var filename = removeExtension(input);
  return {
    input: 's3://'+ options.processing +'/'+ input,
    notifications: options.notification,
    outputs: [{
      url: 's3://'+ options.outbox +'/'+ filename + '.mp4'
    },{
      url: 's3://'+ options.outbox + '/' + filename + '.webm'
    }]
  };
};

var handleError = function(err) {
  console.log(err, err.stack);
};

checkInbox();
console.log('Watching the things.');
