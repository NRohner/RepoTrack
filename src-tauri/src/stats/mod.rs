use crate::models::*;
use chrono::{Duration, Utc};
use std::collections::HashMap;

pub fn compute_stats(data: &RepoTrackFile, activity: Vec<ActivityEntry>) -> ProjectStats {
    let now = Utc::now();
    let week_ago = now - Duration::days(7);
    let month_ago = now - Duration::days(30);

    let bugs: Vec<&Issue> = data.issues.iter().filter(|i| i.issue_type == IssueType::Bug).collect();
    let features: Vec<&Issue> = data.issues.iter().filter(|i| i.issue_type == IssueType::Feature).collect();

    let open_bugs = bugs.iter().filter(|i| i.status == "open" || i.status == "in-progress").count();
    let open_features = features.iter().filter(|i| {
        i.status == "proposed" || i.status == "under-review" || i.status == "planned" || i.status == "in-progress"
    }).count();

    let resolved_this_week = data.issues.iter().filter(|i| {
        i.resolved_at.map(|r| r > week_ago).unwrap_or(false)
    }).count();

    let resolution_times: Vec<f64> = data.issues.iter().filter_map(|i| {
        i.resolved_at.map(|r| (r - i.created_at).num_hours() as f64 / 24.0)
    }).collect();
    let avg_resolution_days = if resolution_times.is_empty() {
        0.0
    } else {
        resolution_times.iter().sum::<f64>() / resolution_times.len() as f64
    };

    let most_voted = features.iter()
        .max_by_key(|f| f.votes.unwrap_or(0))
        .map(|f| (f.title.clone(), f.votes.unwrap_or(0)));

    let bugs_by_severity = count_severity(&bugs, true);
    let features_by_priority = count_severity(&features, false);

    let bugs_by_status = count_status(&bugs);
    let features_by_status = count_status(&features);
    let all_by_status = count_status(&data.issues.iter().collect::<Vec<_>>());

    let resolution_time_buckets = compute_resolution_buckets(&data.issues);
    let creation_heatmap = compute_creation_heatmap(&data.issues);
    let tag_breakdown = compute_tag_breakdown(&data.issues);

    let top_oldest_bugs = compute_oldest_bugs(&bugs, 10);
    let top_voted_features = compute_top_voted(&features, 10);
    let bug_velocity = compute_bug_velocity(&bugs);
    let feature_funnel = compute_feature_funnel(&features);
    let features_by_quarter = compute_features_by_quarter(&features);
    let features_by_tag = compute_features_by_tag(&features);

    let critical_high_bugs = bugs.iter().filter(|b| {
        let sev = b.severity.as_ref().map(|s| format!("{:?}", s).to_lowercase());
        (sev == Some("critical".to_string()) || sev == Some("high".to_string()))
            && (b.status == "open" || b.status == "in-progress")
    }).count();

    let planned_features = features.iter().filter(|f| f.status == "planned").count();
    let completed_features_this_month = features.iter().filter(|f| {
        f.status == "completed" && f.resolved_at.map(|r| r > month_ago).unwrap_or(false)
    }).count();
    let total_votes: i32 = features.iter().map(|f| f.votes.unwrap_or(0)).sum();

    let oldest_open_bug = bugs.iter()
        .filter(|b| b.status == "open" || b.status == "in-progress")
        .min_by_key(|b| b.created_at)
        .map(|b| OldestIssue {
            id: b.id.clone(),
            title: b.title.clone(),
            severity: b.severity.as_ref().map(|s| format!("{:?}", s).to_lowercase()).unwrap_or_default(),
            created_at: b.created_at.to_rfc3339(),
            age_days: (now - b.created_at).num_days(),
        });

    let issues_over_time = compute_issues_over_time(&data.issues);
    let open_bugs_over_time = compute_open_over_time(&bugs, &["open", "in-progress"]);
    let open_features_over_time = compute_open_over_time(&features, &["proposed", "under-review", "planned", "in-progress"]);

    ProjectStats {
        total_issues: data.issues.len(),
        open_bugs,
        open_features,
        resolved_this_week,
        avg_resolution_days,
        most_voted_feature: most_voted.as_ref().map(|(t, _)| t.clone()),
        most_voted_feature_votes: most_voted.map(|(_, v)| v).unwrap_or(0),
        bugs_by_severity,
        features_by_priority,
        bugs_by_status,
        features_by_status,
        all_by_status,
        issues_over_time,
        open_bugs_over_time,
        open_features_over_time,
        resolution_time_buckets,
        creation_heatmap,
        tag_breakdown,
        activity_feed: activity,
        top_oldest_bugs,
        top_voted_features,
        bug_velocity,
        feature_funnel,
        features_by_quarter,
        features_by_tag,
        critical_high_bugs,
        planned_features,
        completed_features_this_month,
        total_votes,
        oldest_open_bug,
    }
}

fn count_severity(issues: &[&Issue], is_bug: bool) -> SeverityCounts {
    let mut counts = SeverityCounts { critical: 0, high: 0, medium: 0, low: 0 };
    for issue in issues {
        let level = if is_bug { &issue.severity } else { &issue.priority };
        if let Some(ref s) = level {
            match s {
                Severity::Critical => counts.critical += 1,
                Severity::High => counts.high += 1,
                Severity::Medium => counts.medium += 1,
                Severity::Low => counts.low += 1,
            }
        }
    }
    counts
}

fn count_status(issues: &[&Issue]) -> Vec<StatusCount> {
    let mut map: HashMap<String, usize> = HashMap::new();
    for issue in issues {
        *map.entry(issue.status.clone()).or_insert(0) += 1;
    }
    let mut result: Vec<StatusCount> = map.into_iter().map(|(status, count)| StatusCount { status, count }).collect();
    result.sort_by(|a, b| b.count.cmp(&a.count));
    result
}

fn compute_resolution_buckets(issues: &[Issue]) -> Vec<BucketCount> {
    let buckets = vec![
        ("< 1 day", 0.0, 1.0),
        ("1-3 days", 1.0, 3.0),
        ("3-7 days", 3.0, 7.0),
        ("1-2 weeks", 7.0, 14.0),
        ("2+ weeks", 14.0, f64::MAX),
    ];
    buckets.iter().map(|(label, min, max)| {
        let mut bugs = 0;
        let mut features = 0;
        for issue in issues {
            if let Some(resolved) = issue.resolved_at {
                let days = (resolved - issue.created_at).num_hours() as f64 / 24.0;
                if days >= *min && days < *max {
                    match issue.issue_type {
                        IssueType::Bug => bugs += 1,
                        IssueType::Feature => features += 1,
                        _ => bugs += 1,
                    }
                }
            }
        }
        BucketCount { bucket: label.to_string(), bugs, features }
    }).collect()
}

fn compute_creation_heatmap(issues: &[Issue]) -> Vec<HeatmapDay> {
    let mut map: HashMap<String, (usize, usize, usize)> = HashMap::new();
    for issue in issues {
        let date = issue.created_at.format("%Y-%m-%d").to_string();
        let entry = map.entry(date).or_insert((0, 0, 0));
        entry.0 += 1;
        match issue.issue_type {
            IssueType::Bug => entry.1 += 1,
            IssueType::Feature => entry.2 += 1,
            _ => entry.1 += 1,
        }
    }
    let mut result: Vec<HeatmapDay> = map.into_iter().map(|(date, (count, bugs, features))| {
        HeatmapDay { date, count, bugs, features }
    }).collect();
    result.sort_by(|a, b| a.date.cmp(&b.date));
    result
}

fn compute_tag_breakdown(issues: &[Issue]) -> Vec<TagInfo> {
    let mut map: HashMap<String, (usize, usize, usize, usize)> = HashMap::new();
    for issue in issues {
        for tag in &issue.tags {
            let entry = map.entry(tag.clone()).or_insert((0, 0, 0, 0));
            entry.0 += 1;
            let is_open_bug = issue.issue_type == IssueType::Bug
                && (issue.status == "open" || issue.status == "in-progress");
            let is_feature = issue.issue_type == IssueType::Feature;
            let is_resolved = issue.resolved_at.is_some();
            if is_open_bug { entry.1 += 1; }
            if is_feature { entry.2 += 1; }
            if is_resolved { entry.3 += 1; }
        }
    }
    let mut result: Vec<TagInfo> = map.into_iter().map(|(tag, (count, open_bugs, features, resolved))| {
        TagInfo { tag, count, open_bugs, features, resolved }
    }).collect();
    result.sort_by(|a, b| b.count.cmp(&a.count));
    result
}

fn compute_oldest_bugs(bugs: &[&Issue], limit: usize) -> Vec<OldestIssue> {
    let now = Utc::now();
    let mut open_bugs: Vec<&Issue> = bugs.iter()
        .filter(|b| b.status == "open" || b.status == "in-progress")
        .copied()
        .collect();
    open_bugs.sort_by_key(|b| b.created_at);
    open_bugs.iter().take(limit).map(|b| OldestIssue {
        id: b.id.clone(),
        title: b.title.clone(),
        severity: b.severity.as_ref().map(|s| format!("{:?}", s).to_lowercase()).unwrap_or_default(),
        created_at: b.created_at.to_rfc3339(),
        age_days: (now - b.created_at).num_days(),
    }).collect()
}

fn compute_top_voted(features: &[&Issue], limit: usize) -> Vec<VotedFeature> {
    let mut sorted: Vec<&&Issue> = features.iter().collect();
    sorted.sort_by(|a, b| b.votes.unwrap_or(0).cmp(&a.votes.unwrap_or(0)));
    sorted.iter().take(limit).map(|f| VotedFeature {
        id: f.id.clone(),
        title: f.title.clone(),
        votes: f.votes.unwrap_or(0),
        status: f.status.clone(),
    }).collect()
}

fn compute_bug_velocity(bugs: &[&Issue]) -> Vec<TimeSeriesPoint> {
    let mut weekly: HashMap<String, usize> = HashMap::new();
    for bug in bugs {
        if let Some(resolved) = bug.resolved_at {
            let week = resolved.format("%Y-W%W").to_string();
            *weekly.entry(week).or_insert(0) += 1;
        }
    }
    let mut result: Vec<TimeSeriesPoint> = weekly.into_iter().map(|(date, value)| {
        TimeSeriesPoint { date, value }
    }).collect();
    result.sort_by(|a, b| a.date.cmp(&b.date));
    result
}

fn compute_feature_funnel(features: &[&Issue]) -> Vec<FunnelStep> {
    let stages = vec!["proposed", "under-review", "planned", "in-progress", "completed"];
    stages.iter().map(|stage| {
        let count = features.iter().filter(|f| f.status == *stage).count();
        FunnelStep { stage: stage.to_string(), count }
    }).collect()
}

fn compute_features_by_quarter(features: &[&Issue]) -> Vec<QuarterGroup> {
    let mut map: HashMap<String, Vec<QuarterFeature>> = HashMap::new();
    for feature in features {
        let quarter = feature.roadmap_quarter.clone().unwrap_or("Backlog".to_string());
        map.entry(quarter).or_default().push(QuarterFeature {
            id: feature.id.clone(),
            title: feature.title.clone(),
            priority: feature.priority.as_ref().map(|p| format!("{:?}", p).to_lowercase()).unwrap_or_default(),
            status: feature.status.clone(),
            votes: feature.votes.unwrap_or(0),
            tags: feature.tags.clone(),
        });
    }
    let mut result: Vec<QuarterGroup> = map.into_iter().map(|(quarter, features)| {
        let total_votes = features.iter().map(|f| f.votes).sum();
        QuarterGroup { quarter, features, total_votes }
    }).collect();
    result.sort_by(|a, b| {
        let order = |q: &str| match q {
            "Backlog" => 999,
            _ => q.replace('Q', "").replace(' ', "").parse::<i32>().unwrap_or(500),
        };
        order(&a.quarter).cmp(&order(&b.quarter))
    });
    result
}

fn compute_features_by_tag(features: &[&Issue]) -> Vec<TagCount> {
    let mut map: HashMap<String, usize> = HashMap::new();
    for feature in features {
        for tag in &feature.tags {
            *map.entry(tag.clone()).or_insert(0) += 1;
        }
    }
    let mut result: Vec<TagCount> = map.into_iter().map(|(tag, count)| TagCount { tag, count }).collect();
    result.sort_by(|a, b| b.count.cmp(&a.count));
    result
}

fn compute_issues_over_time(issues: &[Issue]) -> Vec<TimeSeriesPoint> {
    let mut daily: HashMap<String, usize> = HashMap::new();
    for issue in issues {
        let date = issue.created_at.format("%Y-%m-%d").to_string();
        *daily.entry(date).or_insert(0) += 1;
    }
    let mut result: Vec<TimeSeriesPoint> = daily.into_iter().map(|(date, value)| {
        TimeSeriesPoint { date, value }
    }).collect();
    result.sort_by(|a, b| a.date.cmp(&b.date));
    result
}

fn compute_open_over_time(issues: &[&Issue], open_statuses: &[&str]) -> Vec<TimeSeriesPoint> {
    if issues.is_empty() {
        return vec![];
    }

    let now = Utc::now();
    let earliest = issues.iter().map(|i| i.created_at).min().unwrap_or(now);
    let days = (now - earliest).num_days().min(365);

    let mut result = Vec::new();
    for d in 0..=days {
        let date = earliest + Duration::days(d);
        let date_str = date.format("%Y-%m-%d").to_string();
        let count = issues.iter().filter(|i| {
            i.created_at <= date
                && (open_statuses.contains(&i.status.as_str())
                    || i.resolved_at.map(|r| r > date).unwrap_or(false))
        }).count();
        if d % 7 == 0 || d == days {
            result.push(TimeSeriesPoint { date: date_str, value: count });
        }
    }
    result
}
