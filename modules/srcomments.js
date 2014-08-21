var srcomments = function() {
    var module = new TB.Module('Subreddit Comments');
    $.log("Loading Subreddit Comments module");

    module.settings["enabled"]["default"] = true;

    module.unescape = function(text) {
        return $("<div/>").html(text).text();
    };

    module.template = function(tpl, variables) {
        return tpl.replace(/{{([^}]+)}}/g, function(match, variable) {
            return variables[variable];
        });
    };

    // from r2.lib.utils import title_to_url
    module.title_to_url = function(title) {
        var max_length = 50;

        title = title.replace(/\s+/g, "_");     //remove whitespace
        title = title.replace(/\W+/g, "");      //remove non-printables
        title = title.replace(/_+/g, "_");      //remove double underscores
        title = title.replace(/^_+|_+$/g, "");  //remove trailing underscores
        title = title.toLowerCase();            //lowercase the title

        if(title.length > max_length) {
            title = title.substr(0, max_length);
            title = title.replace(/_[^_]*$/g, "");
        }

        return title || "_";
    };

    module.permalink = function(data) {
        return this.full_comments(data) + data.id;
    };

    module.full_comments = function(data) {
        return this.template("/r/{{subreddit}}/comments/{{link_id}}/{{title}}/", {
            "subreddit": data.subreddit,
            "title": this.title_to_url(data.link_title),
            "link_id": data.link_id.split("_")[1]
        });
    };

    module.wrap = function(tpl) {
        var self = this;
        return function(vars){
            return self.template(tpl, vars);
        };
    };

    module.thing = module.wrap('<div class="thing id-{{name}} noncollapsed comment" onclick="click_thing(this)" data-fullname="{{kind}}_{{id}}" data-ups="?" data-downs="?">' +
        '<p class="parent">' +
            '<a name="{{id}}"></a>' +
            '<a href="{{link_url}}" class="title" rel="nofollow">{{link_title}}</a> by <a href="/user/{{link_author}}" class="author may-blank">{{link_author}}</a>' +
            '<span class="userattrs"></span>  in  <a href="/r/{{subreddit}}/" class="subreddit hover">{{subreddit}}</a>' +
        '</p>' +
        '<div class="midcol unvoted">' +
            '<div class="arrow up login-required" onclick="$(this).vote(r.config.vote_hash, null, event)" role="button" aria-label="upvote" tabindex="0"></div>' +
            '<div class="arrow down login-required" onclick="$(this).vote(r.config.vote_hash, null, event)" role="button" aria-label="downvote" tabindex="0"></div>' +
        '</div>' +
        '<div class="entry unvoted">' +
            '<p class="tagline">' +
                '<a href="javascript:void(0)" class="expand" onclick="return togglecomment(this)">[–]</a>' +
                '<a href="/user/{{author}}" class="author may-blank">{{author}}</a>' +
                '<span class="userattrs"></span> <span class="score unvoted">{{score}} points</span> <time title="Tue Aug 19 2014 16:40:59 GMT+0200 (CEST)" datetime="2014-08-19T14:40:59+00:00" class="live-timestamp">? ago</time> <span class="numchildren"></span>' +
            '</p>' +
            '<div class="usertext"><div class="usertext-body may-blank-within">{{body_html}}</div><div class="clearleft"></div></div>' +
            '<ul class="flat-list buttons"><li class="first"><a href="{{permalink}}" class="bylink" rel="nofollow">permalink</a></li><li class="comment-save-button save-button"><a href="javascript:void(0)">save</a></li><li><a href="{{permalink}}?context=3" class="bylink" rel="nofollow">context</a></li><li class="first"><a href="{{full_comments}}" class="may-blank">full comments</a></li></ul>' +
        '</div>' +
        '<div class="clearleft"></div>' +
    '</div>');

    module.noresults = module.wrap('<p id="noresults" class="error">there doesn\'t seem to be anything here</p>');

    module.nomorecomments = module.wrap('<p id="noresults" class="error">there doesn\'t seem to be anything more here</p>');

    module.morecomments = function($siteTable, username, sr, limit, next) {
        var self = this;
        var $div = $("<div/>", { "class": "nav-buttons" });
        var $span =  $("<span/>", { "class": "nextprev" }).appendTo($div);
        var $a = $("<a/>", {
            "href": "",
            "text": "more ›"
        }).click(function(evt){
            self.get_comments($siteTable, username, sr, limit, next);
            evt.stopPropagation();
            evt.preventDefault();
            $(this).remove();
        }).appendTo($span);
        return $div;
    };

    module.get_comments = function($siteTable, username, sr, limit, next) {
        var self = this;
        var after = next || "", fetched_comments = 0, matched_comments = 0;
        (function get_more_comments(){
            $.getJSON("/user/" + username + "/comments.json", {
                "after": after,
                "limit": 100
            }).success(function(response, status, jqxhr) {
                fetched_comments += response.data.children.length;
                after = response.data.after;
                response.data.children.forEach(function(comment){
                    if(comment.data.subreddit.toLowerCase() === sr) {
                        comment.data.body_html = self.unescape(comment.data.body_html);
                        comment.data.permalink = self.permalink(comment.data);
                        comment.data.full_comments = self.full_comments(comment.data);
                        $siteTable.append(self.thing(comment.data));
                        matched_comments++;
                    }
                });
                if(fetched_comments < limit && after !== null) {
                    /* Give it a second before fetching the rest */
                    setTimeout(get_more_comments, 1000);
                } else if(matched_comments === 0 && after === null) {
                    if(next === null) {
                        $siteTable.append(self.noresults());
                    } else {
                        $siteTable.append(self.nomorecomments());
                    }
                } else if(after !== null) {
                    self.morecomments($siteTable, username, sr, limit, after).appendTo($siteTable);
                }
            });
        })();
    };

    module.run = function() {
        var self = this;
        var $tabmenu = $('#header-bottom-left .tabmenu');
        var $li = $("<li/>").appendTo($tabmenu);
        var $a = $("<a/>", {
            "href": "",
            "text": "subreddit"
        }).click(function(evt){
            var username = $(".pagename").text();
            var subreddit = prompt('Which subreddit do you want to filter by?', '').toLowerCase();
            if(subreddit) {
                var $content = $("#siteTable").parent(".content").empty();
                var $siteTable = $("<div/>", {
                    "id": "siteTable",
                    "class": "sitetable linklisting"
                }).appendTo($content);
                $tabmenu.children("li").removeClass("selected");
                $li.addClass("selected");
                $a.text("subreddit: " + subreddit);
                self.get_comments($siteTable, username, subreddit, 1000);
            }
            evt.stopPropagation();
            evt.preventDefault();
        }).appendTo($li);
    };

    module.init = function() {
        if(!$("body").hasClass("profile-page")) return;
        $.log("Initializing Subreddit Comments module");
        $($.proxy(this.run, this));
    };

    TB.register_module(module);
};

(function(){
    window.addEventListener("TBObjectLoaded", function () {
        srcomments();
    });
})();
