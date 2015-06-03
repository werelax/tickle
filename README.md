# You can touch

Tickle is a simple, robust and readable javascript library for handling touch interaction with sanity. It's implemented in a way that allows you to read the code and understand what it does pretty easily, so if you want to do some oh-so-exotic finger contortion on your UI, you can just fire your editor and add it.

If you skip all the noise I had to add at the top of `ticke.js` just to make sure you can use it with your current setup (whichever it may be), and then you skip some more and jump over all the functions with self-explanatory names like `clone` and `calculatePosition`, you'll end in a big Finite State Machine declaration. That's the meat. That's how this beauty works. The retarded browser events are abstracted as abstract *inputs* to the machine. The machine will change it's state according to the rules defined there, and you can see pretty well the full cycle of events that has to happen for a `@tap` to be detected or a `@pinch` to occur. All the nonsensical intermediate states are there just to rest while the user is trying to decide what to do. For example, you can detect a `touchstart` but that doesn't tell you anything. What's going to happen next? If the user raises her finger fast enough, then you have a `@tap`. If she moves it around, then you have a `@drag`. If she puts another finger down, and *then* moves them independently, we are getting a `@pinch` gesture. So, you see, it's not as easy as `touchstart`, `touchend`, `touchmove`. A gesture needs a *full sequence of events* to determine it's own nature. And that's what the state machine does: provide memory and understand sequences.

> How peachy. Now, look: I'm a mindless zombie and just want to use it now. Plug-n-Play. Don't waste my brain cycles.

Well, good news! You only have to follow this simple steps:

* Download the library, include it in your HTML or whatever.
* You see the `emit` method? Is around the third quarter of the file. Great. Don't lose it.
* Implement whatever you need inside `emit`. Can be a event-emitter of sorts. Or a dispatcher. Or a callback. You know, sky is the limit. Be creative.
* That's cool, right? Can you get more flexible than that? You get to implement *your own method*, the method *you always dreamed about*! And *for free*!

> Wow, thank you. You made my day.

And you made mine, dear user. I'll be right here if you need some touching again.
