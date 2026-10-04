var SMI_Slider = (function () {
    'use strict';
    class SMI_Slider {
          classes = '.smi-swiper'
          sectionId = ''
          el = null
          options = {
              init: false,
              loop: true,
              autoplay: false,
              slidesPerView: 1,
              navigation: {
                  nextEl: `.arrow-slider-right`,
                  prevEl: `.arrow-slider-left`,
              },
              pagination: {
                  el: `.smi-pagination`,
                  clickable: true,
              }
          }
          swiper = null
      
          constructor(_classes, _options) {
              if (_classes) {
                  this.classes = _classes
                  const selectorArr = _classes.split(' ')
                  if(selectorArr.length > 1) {
                      this.sectionId = selectorArr[0]
                      this.options.navigation.nextEl = `${this.sectionId} ${this.options.navigation.nextEl}`
                      this.options.navigation.prevEl = `${this.sectionId} ${this.options.navigation.prevEl}`
                      this.options.pagination.el = `${this.sectionId} ${this.options.pagination.el}`
                  }
              }
              if (_options)
                  this.options = { ...this.options, ..._options }
  
              if (!this.options.pagination) {
                delete this.options['pagination']
              }
  
              if (!this.options.navigation) {
                delete this.options['navigation']
              }
      
              this.el = document.querySelector(this.classes)
              if (!this.el) {
                  return
              }
  
              this._excuteSlider()
              this._fitCoverVideo()
          }
      
          _excuteSlider() {
              if (this.options?.dotStyle) {
                  if (this.options?.dotStyle.includes('text-style')) {
                      this.options.pagination = {
                          el: `${this.sectionId} .smi-pagination`,
                          type: "fraction",
                          clickable: true,
                      }
                  }
              }
  
              if(!this.swiper) {
                this.swiper = new Swiper(this.classes, this.options);
              }
      
              this.swiper.on('init', (swiper) => {
                  this._playVideo()
                  //this._toggleVolume()
                  this._autoPlayVideo(swiper)
                this._handleDesignMode()
              });
      
              this.swiper.on('slideChange', (swiper) => {
                  this._turnOffVolume(swiper)
                  this._pauseVideo()
                  this._autoPlayVideo(swiper)
              })
      
              this.swiper.init();
          }
  
          _handleDesignMode() {
                  if (Shopify.designMode) {
                      const _goToSlide = () => {
                          document.addEventListener("shopify:block:select", (e) => {
                              const slideIndex = e.target.dataset.swiperSlideIndex;    
                              if (slideIndex !== undefined) {
                                  this.swiper.slideTo(slideIndex, 0, false)                                
                              }
                          })
                      }
                      _goToSlide()      
  
                      document.addEventListener("shopify:section:load", (e) => {
                        const slideIndex = this.swiper.activeIndex 
                        let timerCounter = 0
                        setTimeout(() => {
                            let _swiper = document.querySelector(this.classes).swiper
                            if(_swiper) {
                              if(slideIndex !== undefined ) {
                                _swiper.slideTo(slideIndex, 0, false)
                              }
                            }
                        }, 150)
                    });
                  }
              }
      
          _turnOffVolume(swiper) {
            if(!swiper?.slides) {
                return;
            }
              swiper.slides.forEach(slide => {
                  const volumeEl = slide.querySelector('.smi-volume')
                  if (volumeEl) {
                      volumeEl.classList.remove('up')
                  }
                  let video = slide.querySelector('video')
                  let videoY = slide.querySelector('.smi-js-youtube')
                  let videoV = slide.querySelector('.smi-js-vimeo')
                  if (video) {
                      video.muted = true
                  }
      
                  if (videoY) {
                      videoY.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', "*");
                  }
      
                  if (videoV) {
                      videoV.contentWindow.postMessage('{"method":"setVolume", "value":0}', '*');
                  }
              })
          }
      
          _autoPlayVideo(_swiper) {
              const slideActive = _swiper?.slides[_swiper?.activeIndex]
            if(slideActive) {
              const auto = slideActive.getAttribute('data-autoplay')
              if (auto == 'true') {
                  let video = slideActive.querySelector('video')
                  if (video) {
                      video.play()
                  }
      
                  video = slideActive.querySelector('.smi-js-youtube')
                  if (video) {
                      video.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', "*");
                  }
      
                  video = slideActive.querySelector('.smi-js-vimeo')
                  if (video) {
                      video.contentWindow.postMessage('{"method":"play"}', '*');
                  }
              }
            }
          }
      
          _parseResolutionString(res) {
              const pts = res.split(/\s?:\s?/i);
              const DEFAULT_RESOLUTION = 16 / 9;
              if (pts.length < 2) {
                  return DEFAULT_RESOLUTION;
              }
      
              const w = parseInt(pts[0], 10);
              const h = parseInt(pts[1], 10);
      
              if (isNaN(w) || isNaN(h)) {
                  return DEFAULT_RESOLUTION;
              }
      
              return w / h;
          }
      
          _fitCoverVideo() {
              const resolution_mod = this._parseResolutionString("16:9");
              const onResize = () => {
                  const iframes = this.el.querySelectorAll('iframe')
                  if (iframes.length) {
                      const h = this.el.offsetHeight + 200;
                      const w = this.el.querySelector('.smi-item__media').offsetWidth + 200;
                      const res = resolution_mod;
                      iframes.forEach(iframe => {
                          if (iframe.classList.contains('smi-background-video')) {
                              if (res > w / h) {
                                  iframe.style.width = h * res + 'px';
                                  iframe.style.height = h + 'px';
                              } else {
                                  iframe.style.width = w + 'px';
                                  iframe.style.height = w / res + 'px';
                              }
                          }
                      })
                  }
              }
      
              window.addEventListener('resize', () => {
                  window.requestAnimationFrame(onResize);
              });
      
              onResize();
          }
      
          _pauseVideo() {
              let videos = this.el.querySelectorAll('video')
              if (videos.length) {
                  videos.forEach(video => {
                      video.pause();
                  })
              }
  
              this.el.querySelectorAll('.smi-js-youtube').forEach((video) => {
                  video.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', "*");
              });
  
              this.el.querySelectorAll('.smi-js-vimeo').forEach((video) => {
                  video.contentWindow.postMessage('{"method":"pause"}', '*');
              });
    
          }
      
          _playVideo() {
              const buttons = this.el.querySelectorAll('.smi-cover-image__play-button.play-now')
      
              if (!buttons.length) {
                  return null
              }
      
              buttons.forEach((button) => {
                  button.addEventListener('click', e => {
                      button.closest('.smi-cover-image').classList.add('smi-d-none')
      
                      this.el.querySelectorAll('video').forEach(video => {
                          video.play();
                      })
      
                      this.el.querySelectorAll('.smi-js-youtube').forEach((video) => {
                          video.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', "*");
                      });
      
                      this.el.querySelectorAll('.smi-js-vimeo').forEach((video) => {
                          video.contentWindow.postMessage('{"method":"play"}', '*');
                      });
                  })
              })
          }
      }  
    
      return SMI_Slider
    
    })();


