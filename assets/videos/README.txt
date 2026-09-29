Put your own video file in this folder (for example: intro.mp4).

Then, in media.html, replace the YouTube iframe embed card with an HTML5 video:

  <div class="media-frame">
    <video controls preload="metadata" poster="assets/images/photography.svg">
      <source src="assets/videos/intro.mp4" type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  </div>

The gallery currently uses a YouTube embed placeholder so the Media page
renders a working video out of the box.
