$(function(){
	//TODO: Implement the resource that allows user filter friends blahblah
	var form = $('#urls-form'), 
		inputsField = $('#inputs-field'),
		commentsBox = $('#comments-box'),
		photosBox = $('#photos-watcher-content'),
		statusBox = $('#status-watcher-content'),
		feedBox = $('#feed-watcher-content'),
		actionBtn = $('button[type=submit]', form),
		friendsThumbsContainer = $('#friends-thumbs'),
		friendsThumbs,
		noticeBox = $('div.notices'),
		modal = $('#select-friend-box'),
		totalInputs = 1;

	// MeninoGaiato
	var MG = {

		scope: 'user_photos,user_status,friends_photos,friends_status',
		
		curUserID: undefined,

		init: function(){
			// #comments-watcher
			// TODO: Add #comments to shared

			$('#add-url').click(function(){
				MG.addInput();
			});

			$('button.url-remove-btn', form).click(function(){
				$(this).parent().remove();
			});
			// Set all config for objects in MG.shared.objs
			MG.shared.init();

			// Kick friends search [in modal]
			$('#friend-search').bind('keydown keyup', function(){
				var val = $(this).val();

				MG.friendSearch( val );
			});
		},

		localStorage: {
			init: function(){
				if( !localStorage.MeninoGaiato )
					localStorage.setItem(MeninoGaiato, '{ urls: [] }');
			},

			addURL: function( url ){
				var obj = JSON.parse(localStorage.MeninoGaiato);
				if( url.constructor === Array ){
					obj.urls.push(url);
				} else {
					obj.urls = obj.urls.concat(url);
				}

				localStorage.MeninoGaiato = JSON.stringify(obj);
			},

			delURL: function( url ){
				var obj = JSON.parse(localStorage.MeninoGaiato), newArr = [];

				$.each(obj.urls, function(i, u){
					if( url != u ) newArr.push(u);
				});

				obj.urls = newArr;
				localStorage.MeninoGaiato = JSON.stringify( obj );
			} 
		},

		delInput: function( el ){
			$(this).parent().remove();
		},

		addInput: function(){
			var div = '<div class="form-group well">'
				div += "<input type='url' class='form-control' name='form-url-$id' placeholder='http://facebook.com/something-else'/>";
				div += "<br/><button type='button' ref-url='$id' class='btn btn-danger url-remove-btn'>remover</button>";
				div += '</div>';
				div.replace(/\$id/g, totalInputs);
				totalInputs++;

			div = $(div);

			div.find('button').bind('click', MG.delInput);
			div.appendTo(inputsField);
		},

		parseObjID: function( url ){
			var id = url.match(/(comment_id=\d+)/g);
				id = id[0].match(/\d+/g);

			return id[0]; 
		},

		//TODO: make MG#getComments support data paging
		getComment: function( objID, fn ){
			var fql = 'SELECT fromid, like_info, time, comment_count, text FROM comment WHERE comment_id = ' + objID;

			FB.api({
				method: 'fql.query',
				query: fql
			}, function(data){
				fn( data );
			})
		},

		showComments: function( posts ){
			console.log('preparing to show commments');
			console.log(posts);

			$.each( post, function(i, post){
				//TODO: Finish this later. Okay?
				//TODO: Use templates
				var postDiv = $('<div class="post"><h3>post #' + post.urlID + '</h3></div>');
					postDiv.appendTo(commentsBox);

				$.each(post, function( i, comment){
					var div = '<div class="comment well">';
						div += '<h3>' + comment.text + '</h3>';
						div += '<hr/><p class="lead">'+ comment.likes +' Likes</p>';
						div += '<p class="lead">'+ comment.comment_count +'  replies</p>';
						div += '</div>';

					div = $(div);

					div.appendTo(postDiv);
				});
			});
		},

		shared: {
			objs: 'photos status feed',

			init: function(){
				$.each( MG.shared.objs.split(' ') , function(i, fbObject){
					// By passed link
					if( location.href.indexOf('?u=') > -1 ){
						noticeBox
							.html('Você veio aqui pelo link que alguém ti deu, para ver é só clicar em <b>"Ver fotos/status mais curtidos"</b>-><b>"Pelo link"</b>');
						
						$('#tab-menu .for-'+ fbObject +' li.on-link')
							.show()
							.find('a')
							.bind('click', function(){
								if( location.href.indexOf('?u=') > -1 ){
									linkUserID = location.href.split('?u=')[1];
								}

								MG[fbObject].setAllToUser(LinkUserID);
							});
					}					

					// For current user {fbObject}
					$('#tab-menu .for-'+ fbObject +' li.my-'+ fbObject +'-watcher a').bind('click', function(){
						MG.curUserID = FB.getUserID();
						MG[fbObject].setAllToUser();
					});				

					// For a friend {fbObject}
					var selector = '#tab-menu .for-'+ fbObject +' li.friend-'+ fbObject +'-watcher a';

					$( selector ).bind('click', function(){
						NProgress.inc();
						MG.curEvent = 'friend-' + fbObject;

						MG.getFriendID(function( userID ){
							MG[fbObject].setAllToUser( userID );
							MG.curUserID = userID;

							NProgress.done(true);
						}, 'friend-'+ fbObject );
					});

					// Filter a friend who likes {fbObject} of current user
					$('#'+ fbObject +'-watcher a.friend-filter-btn').bind('click', function(){
						MG.curEvent = 'filter-friend-' + fbObject;

						NProgress.inc();
						MG.getFriendID(function( likeUserID, likeUserName ){
							MG[fbObject].setAllToUser( MG.curUserID, likeUserID );
							noticeBox.html('Você está vendo os status/fotos que ' + likeUserName + ' curtiu');

							NProgress.done(true);
						}, 'filter-friend-' + fbObject);
					});					
				});
			},

			setAllToUser: function( userID, likeUserID, objName, limit ){
				console.log('#'+ objName+'-watcher!');

				limit = limit || 5;
				$('#'+ objName +'-watcher .progress').toggleClass('active');
				MG.forceLogin(function( response ){
					if( response == 'ok' ){

						NProgress.inc();
						MG.shared.get( userID, likeUserID, objName, limit );

					} else {
						noticeBox
							.fadeOut( 50 )
							.fadeIn( 100 )
							.html('<b>Ahh lek!</b> Alguma coisa deu errado, tente recarregar a página e tente de novo.');
						NProgress.done(true);
					}
				});
			},

			get: function( userID, likeUserID, objName, limit ){
				MG[ objName ].get(limit, function(data){
					if( data.error ){
						(noticeBox)
							.html('Hmmm... alguma coisa deu errada, notifique-me no Facebook (grubens1) sobre o erro');
					} else {
						MG[ objName ].createView(data, function(){
							$( '#'+ objName + '-watcher .progress' ).toggleClass('active');

							(noticeBox)
								.html('Que tal compartilhar o <b>seu</b> rank com seus amigos? Aqui está o link <b>http://grsabreu.github.io/YouEpic/?u=' + FB.getUserID() + '</b>');								
						});
					}
					NProgress.done(true)
				}, userID, likeUserID);
			}
		},

		photos: {
			setAllToUser: function( userID, likeUserID, limit ){
				MG.shared.setAllToUser( userID, likeUserID, 'photos', limit );
			},

			get: function(limit, fn, userID, likeUserID){
				limit = limit || 3;
				userID = userID || FB.getUserID();

				var query = '';
				if( !likeUserID ){
					query = 'SELECT pid, caption, link, like_info, comment_info,src_big FROM photo WHERE aid IN ( SELECT aid FROM album WHERE owner = '+ userID +' ) ORDER BY like_info.like_count DESC LIMIT 0,' + limit;
				} else {
					query = 'SELECT pid, caption, link, like_info, comment_info, src_big FROM photo WHERE object_id IN ( SELECT object_id, object_type, user_id FROM like WHERE object_id IN ( SELECT object_id FROM photo WHERE owner = '+ userID +' ) AND user_id = '+ likeUserID +' )';
				}

				FB.api({
					method: 'fql.query',
					query: query
				}, function(data){
					console.log(data);
					fn(data);
				});
			},

			createView: function( photos, fn ){
				console.log('preparing to show photos');
				console.log(photos);

				photosBox.cleanup();
				$.each( photos, function(i, photo){
					var div = '<div class="photo well" style="text-align:center">';
						div += '<a href="' + photo.link + '">';
						div += '<img src="'+ photo.src_big +'" class="img-thumbnail"/></a><hr/>';
						
						if( photo.caption ){
							div += '<p class="lead caption">"' + photo.caption.replace('\n', '<br>') + '</p>';
						}
						
						div += '<p class="lead counter">Likes ' + photo.like_info.like_count + ' | Comments ' + photo.comment_info.comment_count;
						div += '</p>';
						div += '</div>';

					div = $(div);

					div.appendTo(photosBox);
				});

				fn();
			}			
		},

		status: {

			setAllToUser: function( userID, likeUserID, limit ){
				MG.shared.setAllToUser(userID, likeUserID, 'status', limit);
			},

			get: function( limit, fn, userID, likeUserID ){
				var query = '';
					userID = userID || FB.getUserID();
					limit = limit || 5;

				if( !likeUserID )
					query = 'SELECT message, like_info, comment_info, status_id FROM status WHERE uid = '+ userID +' ORDER BY like_info.like_count DESC LIMIT 0,'+ limit;
				else
					query = 'SELECT status_id, message, like_info, comment_info FROM status WHERE status_id IN ( SELECT object_id FROM like WHERE object_id IN ( SELECT status_id FROM status WHERE uid = '+ userID +' ) AND user_id = '+ likeUserID +' ) ORDER BY like_info.like_count DESC LIMIT 0,' + limit;
				
				FB.api({
					method: 'fql.query',
					query: query
				}, function(data){
					fn(data);
				});				
			},

			createView: function( statuss ){
				console.log('preparing to show status');
				console.log(statuss);

				statusBox.cleanup();
				$.each(statuss, function(i, status){
					var div = '<div class="well status" style="text-align:jusfify">'
						div += '<h3><a href="https://facebook.com/'+ MG.curUserID +'/posts/'+ status.status_id + '">';
						div += status.message.replace('\n', '<br>');
						div += '</a></h3><hr/>';
						div += '<p class="lead"> Likes '+ status.like_info.like_count;
						div += ' | Comments ' + status.comment_info.comment_count + '</p></div>';

					div = $(div);

					div.appendTo(statusBox);
				});
			}
		},

		comments: {

		},

		feed: {
			get: function( fn, uid ){
				FB.api('/' + uid + '/feed', function(data){
					fn(data);
				})
			},
			// TODO: FINISH THIS
			createView: function( feed ){
				console.log('preparing to show feed');
				console.log(feed);

				feedBox.cleanup();
				$.each(feed, function(i, fd){
					var div = '<div class="well feed" style="text-align:jusfify">'
						div += '<h3><a href="'+ fd.story + '">';
						div += status.message.replace('\n', '<br>');
						div += '</a></h3><hr/>';
						div += '<p class="lead"> '+ status.like_info.like_count;
						div += ' | Comments ' + status.comment_info.comment_count + '</p></div>';

					div = $(div);

					div.appendTo(statusBox);
				});				
			}
		},

		checkLogin: function(fns){
			var status = '';
			FB.getLoginStatus(function(status){
				if(status.status == 'connected'){ 
					if( fns.success ) fns.success();
				}
				else {
					if( fns.error ) fns.error();
					else alert('Não foi possível conectar com sua conta do Facebook.')
				}
			})
		},

		forceLogin: function( fn ){
			var fns = {
				success: function(){
					console.log("Hey, you're logged!");
					fn('ok');
				},

				error: function(){
					fn('error');
					FB.login(function(){
						// Reload it
						MG.checkLogin(fns);
					}, {scope: MG.scope});
				}				
			};

			MG.checkLogin( fns );		
		},

		sortBy: function( key, objsArr ){
			var sortedArr;

			sortedArr = objsArr.sort(function( a, b ){
				return a[key] < b[key];
			});

			return sortedArr;
		},

		// Controls the modal. When user click in a box, returns the id of selected friend
		friendsGot: false,

		curEvent: '',

		// MG#getFriendID
		// callback: will receive the UID 
		// curEvent: MG event
		getFriendID: function( callback, curEvent ){
			$('#select-friend-box').modal('show');

			console.log('invoking FB#api. Waiting data...');
			if( !MG.friendsGot )
				FB.api('/me/friends', function(friendsBlocks){
					$.each(friendsBlocks, function(j, block){
						$.each( block, function(i, friend){
							var li = '<a href="#" class="friend btn btn-primary btn-lg btn-block" user-id="'+ friend.id +'">';
								li += friend.name;
								li += '</a>';

							li = $(li);
							li.appendTo( friendsThumbsContainer );
						});
					});

					MG.friendsGot = true;

					friendsThumbs = $('#friends-thumbs .friend');
					friendsThumbs.bind('click', bindEvent);

					$('#friend-search-loading-bar').hide();
					$('#friend-search').fadeIn(200);
				});
			else
				friendsThumbs.bind('click', bindEvent);

			function bindEvent(){
				if( MG.curEvent == curEvent ){
					modal.modal('hide');

					var userID = $(this).attr('user-id'),
						userName = $(this).text();
					callback( userID, userName );
				}				
			}
		},

		friendSearch: function( search ){
			search = search.toLowerCase();
			if( search == '' )
				friendsThumbs.show();
			else
				friendsThumbs.show().each(function(){
					var userName = $(this).text().toLowerCase();
					if( userName.slice(0, search.length) != search ){
						$(this).hide();
					}
				});
		},

		// Return ID[s] from URL
		// ?u=ID, indicates just a friend
		// ?=ID,ID2 indicates a relationship
		parseURL: function(){
			var loc = location.href;
			if( loc.indexOf('?=u') > -1 ){
				if( loc.indexOf(',') > -1 ){
					var ids = loc.match(/\d+,\d+/g)[0].split(',');

					return ids;
				} else {
					var id = loc.match(/\d+/g)[0]

					return id;
				}
			}
			else
				return false; // nothing in the URL
		},

		getFriendFeed: function( fn ){
			MG.getFriendID(function( uid, userName ){
				console.log('MG#getFriendFeed initializing');

				FB.api('/' + uid + '/feed', function( data ){
					fn( data )
				})
			})
		}
	}

	MG.init();

	window.MG = MG;

	$.fn.vals = function( filter ){
		var vals = [];

		$(this).each(function(){
			vals.push( $(this).val() );
		});

		return vals;
	}

	$.fn.cleanup = function(){
		return $(this).html('');
	}
})