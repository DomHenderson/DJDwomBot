export interface RedditResponse {
	data: RedditData;
}

export interface RedditData {
	data: RedditFeedData;
}

export interface RedditFeedData {
	children: RedditPost[];
}

export interface RedditPost {
	data: RedditPostData;
}

export interface RedditPostData {
	url: string;
}