/* Engine sample — one loop of a V10 at a steady 371 Hz firing
 * frequency, which is around 4447 rpm.
 *
 * Cut from a longer recording: the steadiest 0.95 seconds of it, with the
 * loop length chosen to minimise the waveform discontinuity at the seam and a
 * 12 ms equal-power crossfade over the join. Everything the engine does at
 * other revs is this clip played faster or slower.
 *
 * Embedded as base64 rather than fetched, so standalone.html still works when
 * opened straight from disk, where fetch is blocked.
 *
 * SOURCE AND LICENCE: supplied by the project owner. Confirm the licence
 * permits redistribution before shipping — a royalty-free download is not
 * automatically redistributable inside a product.
 */
export const SAMPLE = {
  /* Firing frequency of the clip as recorded. Playback rate is worked out
     against this, so it must match the audio or every gear is out of tune. */
  baseHz: 370.6,
  /* Intended loop length. The decoder adds a little silence at the front of
     an mp3, so the real loop points are found at decode time rather than
     assumed — see findLoopPoints. */
  loopSeconds: 0.9478,
  mime: 'audio/mpeg',
  base64:
  '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' +
  '0VDEsF5kcpMm0ZbXECBkyUrHvKqlSVuipfWmaGzqusn2OUe2GbbfFj9ysqZdMVvnA4gUCMDE6HgnQgQp+UlNs+QjviIGRfgoQi+d' +
  'TosQevOA8v/uuTd3X81+W4IBYAKV7erDsplpCyLNRjcVQCYPxAMEpWGIHxeDh65C6kiZOrl2VLLLt114UDOq5azmoU73bFXcVb26' +
  '0GGJjcLKq+hEpYU+GR9LG/0AQMDgKSFqdYBlOgS7P3X/qFAuP73/+2DE6QCPwPlp7DDNQc0XbTWGGeh+u3//qv+1wCEAAAAJyJLl' +
  'tviq9ajywVAoOXIF/y9sCxYnk7QHaXJDQmMB+aQkREK5k4ueV1NdEsNOhJk4uqw50Eppv23RZxr4vrpS9rVsNvMhXlHZ35ep7e/+' +
  'Ff+MNl9z3d1WImkrvH7dqeF53Xme8lCmAEwKh88PdrVQtAADIAABAAABScb8jrgytVcEoRF+QIENJkCgZSmk0ohAUeMst0XPXKzj' +
  'mCKFSpXQnYjZsjuDUqlihRjCJcbhqmGolcYUHNcG8n1afijXSFHLEa/7Y2pEdiqvRiecoKEwXCudY9jkdx3irg7Q9riWZoE+c1//' +
  '+2DE6ACPzPVlrDBvyaAYrXWGDbGcbqxHssvWLcWIyuULauUi8uX9s1zWFiNBViqbozkrGvT+SjexeM8a4kO8ema/OLY3XOpq4l3L' +
  'aSmqZvTTI2QWeC5vHJku4Mc7+SFi2fXWcWtuCJf/8YXJhk4AwOQYfUxBTUUzLjEwMFVVVVVVVVVVVVVVVW05SCj0kJQldDeEOWB9' +
  'CHEKWlKcpoqFsQQIiLEdGRk9i4yPgqCp0ShrrBUsHAaBpYKgUFToiPKBo8CrzvR1A1W5YKuBpwNHip0r/qPRLBVyj3/+HazpU7T/' +
  '/qfREqpMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqr/+2LE7IAOxSdpVYSAE0ayq+sy8ACqqqqqqqqqqqqqqqqqqqqqqqqq' +
  'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq' +
  'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq' +
  'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//tg' +
  'xLaDy6Q/Bhz2AAAAADSAAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq' +
  'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq' +
  'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq' +
  'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'
};
