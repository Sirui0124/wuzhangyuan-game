#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
@interface GameDelegate : NSObject <NSApplicationDelegate, NSWindowDelegate>
@property NSWindow *window;
@property WKWebView *web;
@property NSTextField *status;
@property NSTask *runtime;
@property NSMutableData *buffer;
@end
@implementation GameDelegate
- (void)applicationDidFinishLaunching:(NSNotification *)note {
    self.window = [[NSWindow alloc] initWithContentRect:NSMakeRect(0, 0, 1440, 900) styleMask:NSWindowStyleMaskTitled|NSWindowStyleMaskClosable|NSWindowStyleMaskMiniaturizable|NSWindowStyleMaskResizable backing:NSBackingStoreBuffered defer:NO];
    self.window.title = @"逆转五丈原"; self.window.delegate = self;
    self.window.minSize = NSMakeSize(800, 600); [self.window center];
    WKWebViewConfiguration *configuration = [WKWebViewConfiguration new];
    configuration.mediaTypesRequiringUserActionForPlayback = WKAudiovisualMediaTypeNone;
    configuration.websiteDataStore = [WKWebsiteDataStore defaultDataStore];
    self.web = [[WKWebView alloc] initWithFrame:self.window.contentView.bounds configuration:configuration];
    self.web.autoresizingMask = NSViewWidthSizable|NSViewHeightSizable;
    [self.window.contentView addSubview:self.web];
    self.status = [NSTextField labelWithString:@"正在启动逆转五丈原……"];
    self.status.frame = NSMakeRect(40, 100, 1000, 40); [self.window.contentView addSubview:self.status];
    [self.window makeKeyAndOrderFront:nil]; [NSApp activateIgnoringOtherApps:YES];
    NSString *resources = NSBundle.mainBundle.resourcePath;
    self.runtime = [NSTask new]; self.runtime.executableURL = [NSURL fileURLWithPath:[resources stringByAppendingPathComponent:@"node"]];
    self.runtime.arguments = @[[resources stringByAppendingPathComponent:@"run.mjs"], @"--no-open"];
    NSPipe *pipe = [NSPipe pipe]; self.runtime.standardOutput = pipe; self.runtime.standardError = pipe; self.buffer = [NSMutableData new];
    __weak GameDelegate *weak = self;
    pipe.fileHandleForReading.readabilityHandler = ^(NSFileHandle *handle) {
        NSData *data = handle.availableData; if (!data.length) {handle.readabilityHandler = nil; return;}
        dispatch_async(dispatch_get_main_queue(), ^{
            GameDelegate *owner = weak; if (!owner) return; [owner.buffer appendData:data];
            NSString *message = [[NSString alloc] initWithData:owner.buffer encoding:NSUTF8StringEncoding];
            for (NSString *line in [message componentsSeparatedByString:@"\n"]) {
                if ([line hasPrefix:@"WUZHANG_READY "]) { NSURL *url = [NSURL URLWithString:[line substringFromIndex:14]]; [owner.web loadRequest:[NSURLRequest requestWithURL:url]]; owner.status.hidden = YES; handle.readabilityHandler = nil; break; }
                if ([line hasPrefix:@"WUZHANG_ERROR "]) owner.status.stringValue = [line substringFromIndex:14];
            }
        });
    };
    NSError *error = nil; if (![self.runtime launchAndReturnError:&error]) self.status.stringValue = @"游戏运行环境未能启动，请重新解压完整的游戏包。";
}
- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender { return YES; }
- (void)applicationWillTerminate:(NSNotification *)note { if (self.runtime.running) [self.runtime terminate]; }
@end
int main(int argc, const char *argv[]) { @autoreleasepool {NSApplication *app = NSApplication.sharedApplication; app.activationPolicy = NSApplicationActivationPolicyRegular; GameDelegate *delegate = [GameDelegate new]; app.delegate = delegate; [app run];} return 0; }
