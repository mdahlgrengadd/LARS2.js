import * as wavesAudio from 'waves-audio';
import * as wavesLoaders from 'waves-loaders';

import WebAudio from '../node_modules/wavesurfer.js/src/webaudio';

const util = require('audio-buffer-utils');

const PLAYING = 'playing';
const PAUSED = 'paused';
const FINISHED = 'finished';

const BUFFER_LENGTH = 12;

Number.prototype.mod = function(n) {
    return ((this % n) + n) % n;
};

// Allows individual looping and speed control for 
// instance if several segment engines have been added to 
// the same global transport.
const _WRAP_SEGMENTENGINE_IN_PLAYCONTROL = false;

export default class MyWebAudio extends WebAudio {
    constructor(params) {
        super(params);
        //console.log("MyWebAudio params: ");
        //console.log(params);
        if (params.transport)
            this.transport = params.transport;
        if (params.playctrl)
            this.playControl = params.playctrl;

        this.startOffset = 0;
        this.currentBufferSegment = 0;

    }

    setupSegmentPlayer(segmentDescriptions) {
        if (!this.buffer) {
            console.log("No buffer, is wavesurfer ready?")
            return;
        }

        // If no segment description (json) has been loaded,
        // create one segment of the whole audio buffer.
        if (!segmentDescriptions) {
            segmentDescriptions = {
                "I": [0],
                "duration": [this.getDuration()],
                "offset": [0],
                "loudness": [0]
            }

        }
        console.log("segments: " + JSON.stringify(segmentDescriptions))

        // Pick a segment from the description
        let progressions = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
        //let progressions = ['I',  'IV', 'V'];
        this.Engines = [];
        for (let _progression of progressions) {
            let _chord = segmentDescriptions[_progression];
            let loopstart = _chord[0];
            let loopend = _chord[_chord.length - 1];

            let subbuf = util.slice(this.source.buffer, loopstart * 44100, loopend * 44100);

            let segEng = new wavesAudio.SegmentEngine({
                buffer: subbuf,
                positionArray: segmentDescriptions.I,
                durationArray: segmentDescriptions.duration,
                offsetArray: segmentDescriptions.offset,
                durationRel: 0.95,
                releaseAbs: 0.005,
                releaseRel: 0.005,
                resampling: 0,
                wrapAroundExtension: 0,
                cyclic: true,

            });
            segEng.connect(this.analyser);
            this.Engines.push(segEng);
        }

        this._wrapPlayer = new wavesAudio.PlayControl(this.Engines[0]);
        this.currentEngine = this.Engines[0];
        this.transport.add(this._wrapPlayer);

        //this.switchEngine();

    }

    loadFromJson(json) {
        this.segmentDescriptions = json;
        this.setupSegmentPlayer(json);
        return 'Dummy';
    }

    setMasterTransport(master) {

        this.transport = master;
        console.log("new master transport:");
        console.log(master);

    }

    setMasterPlayControl(control) {

        this.playControl = control;
        console.log("new master play control:");
        console.log(control);
    }

    switchEngine() {
        let idx = Math.floor(Math.random() * this.Engines.length);
        let item = this.Engines[idx];
        this.currentBufferSegment = idx;

        this._wrapPlayer.set(item);
        this.currentEngine = item;
        this.startOffset = idx * BUFFER_LENGTH; 
    }

    getAudioContext() {
        if (!window.WaveSurferAudioContext) {

            window.WaveSurferAudioContext = wavesAudio.audioContext;
        }

        return window.WaveSurferAudioContext;
    }

    addOnAudioProcess() {
        /*const my = this;

        this.scriptNode.onaudioprocess = function(e) {
            const time = my.getCurrentTime();

            if (time >= my.getDuration() || time < 0) {
                //my.setState(FINISHED);
                my.fireEvent('pause');
            } else if (time >= my.scheduledPause && my.playControl && !my.playControl.loop) {
                //my.setState(PAUSED);
                my.fireEvent('pause');
            } else if (my.state === my.states[PLAYING]) {
                my.fireEvent('audioprocess', time);
            }

        };*/
    }

    destroy() {
        console.log('FIXME: Do cleanup of wavesjs etc...');
        super.destroy();
    }

    createSource() {
        this.disconnectSource();
        this.source = this.ac.createBufferSource();

        //adjust for old browsers.
        this.source.start = this.source.start || this.source.noteGrainOn;
        this.source.stop = this.source.stop || this.source.noteOff;

        this.source.playbackRate.value = this.playbackRate;
        this.source.buffer = this.buffer;

        const scheduler = wavesAudio.getScheduler();
        // Create Progression display

        this.positionDisplay = new wavesAudio.TimeEngine();
        this.positionDisplay.period = 0.05;

        let _flag = false;
        this.positionDisplay.advanceTime = (time) => {
            this.fireEvent('audioprocess', time);
            if (this.currentEngine) {
                if (this.currentEngine.segmentIndex > 8) {
                    if (!_flag) {
                        scheduler.remove(this.positionDisplay);
                        this.switchEngine();
                        scheduler.add(this.positionDisplay);
                        console.log("trigger")
                        _flag = true;
                    }
                } else {
                    _flag = false;
                }

            }


            return time + this.positionDisplay.period;
        };

        scheduler.add(this.positionDisplay);
        this.setState(PLAYING);

        this.fireEvent('play');

    }

    seekTo(start, end) {

    }

    getPlayedTime() {

        let len = this.Engines[this.currentBufferSegment].bufferDuration;

        return this.startOffset + (this._wrapPlayer.currentPosition).mod(len);

    }
    play(start, end) {
        if (!this.buffer) {
            return;
        }
    }

    pause() {}

    setPlaybackRate(value) {

    }

}