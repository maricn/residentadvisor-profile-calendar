const expect = require('chai').expect;
const racal = require('../.');

const setupRecorder = require('nock-record').setupRecorder;

const record = setupRecorder();

describe('#getTopics', () => {
  it('should get all topics', async () => {
    // Start recording, specify fixture name
    const { completeRecording } = await record('resadv');

    // Our actual function under test
    const result = await racal.getResAdvCalendar('maricn');

    // Complete the recording, allow for Nock to write fixtures
    completeRecording();
//    expect(result).to.equal([
//      'Home',
//      'Tech',
//      'Culture',
//      'Entrepreneurship',
//      'Self',
//      'Politics',
//      'Media',
//      'Design',
//      'Science',
//      'Work',
//      'Popular',
//      'More'
//    ]);
  });
});
